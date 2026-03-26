# Architecture Document — Chinese Standard Mahjong Online

## 1. High-Level Architecture

```
┌──────────────┐         WebSocket / HTTP         ┌──────────────────┐
│   Browser     │ ◄──────────────────────────────► │   Game Server    │
│  (React SPA)  │                                  │   (Node.js)      │
│               │         WebRTC (peer)            │                  │
│  ┌──────────┐ │ ◄──────────────────────────────► │  ┌────────────┐  │
│  │Voice Chat│ │         STUN/TURN                │  │Signaling   │  │
│  └──────────┘ │                                  │  └────────────┘  │
└──────────────┘                                   └────────┬─────────┘
                                                            │
                                                   ┌────────▼─────────┐
                                                   │   PostgreSQL     │
                                                   │   + Redis        │
                                                   └──────────────────┘
```

---

## 2. Technology Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React + TypeScript | Component model fits tile-based UI; strong ecosystem |
| 3D Rendering | Three.js + React-Three-Fiber (R3F) | Mahjong Soul-class 3D visuals; declarative scene graph via R3F |
| 3D Helpers | @react-three/drei | Pre-built components: Html overlays, shadows, environment maps |
| State management | Zustand | Lightweight, sufficient for game state; R3F hooks integrate directly |
| Styling | Tailwind CSS | Rapid UI development for lobby/overlay components |
| Real-time transport | Socket.IO (WebSocket) | Reliable bidirectional communication with fallback |
| Voice chat | WebRTC (via PeerJS or simple-peer) | Peer-to-peer audio, low latency |
| Signaling server | Socket.IO (shared) | Reuse existing WebSocket connection for signaling |
| Backend | Node.js + Express | JS everywhere; fast iteration |
| Game engine | TypeScript (shared package) | Shared logic between client (validation) and server (authority) |
| Database | PostgreSQL | Relational model fits user/game/history data |
| Cache / pub-sub | Redis | Room state caching, cross-instance pub-sub |
| Auth | JWT + bcrypt | Stateless auth; simple guest tokens |
| Deployment | Docker + docker-compose → cloud | Reproducible environments |

---

## 3. Project Structure (Monorepo)

```
mahjong/
├── doc/                    # This documentation
├── packages/
│   ├── common/             # Shared types, tile definitions, scoring logic
│   │   ├── src/
│   │   │   ├── tiles.ts          # Tile enum, tile set generation
│   │   │   ├── rules.ts          # Win detection, fan calculation
│   │   │   ├── scoring.ts        # Point computation (81 fan patterns)
│   │   │   ├── game-state.ts     # Canonical game state type
│   │   │   └── constants.ts      # Game constants
│   │   └── package.json
│   ├── server/             # Game server
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point
│   │   │   ├── socket/           # Socket.IO event handlers
│   │   │   ├── game/             # Server-side game manager
│   │   │   ├── room/             # Room lifecycle
│   │   │   ├── auth/             # JWT, registration, guest
│   │   │   ├── db/               # PostgreSQL models & queries
│   │   │   ├── voice/            # WebRTC signaling
│   │   │   └── ai/               # Robot player logic (Phase 5)
│   │   └── package.json
│   └── client/             # React SPA
│       ├── src/
│       │   ├── components/       # UI components
│       │   │   ├── Lobby/
│       │   │   ├── three/        # Three.js 3D rendering layer
│       │   │   │   ├── GameCanvas.tsx    # R3F <Canvas> mount, scene composition
│       │   │   │   ├── TileMesh.tsx      # 3D tile (BoxGeometry + materials)
│       │   │   │   ├── TableMesh.tsx     # Table surface + border meshes
│       │   │   │   ├── HandLayout.tsx    # Hand tile positioning
│       │   │   │   ├── TableOverlays.tsx # Player labels, bonus tiles, turn indicator
│       │   │   │   ├── SceneLighting.tsx # Lights + shadows
│       │   │   │   └── animations.ts     # Tween/clock animation helpers
│       │   │   ├── overlays/     # HTML overlays on 3D canvas
│       │   │   │   ├── PlayerLabel.tsx
│       │   │   │   ├── ActionPrompt.tsx
│       │   │   │   └── ScoreBoard.tsx
│       │   │   ├── ScoreBoard/
│       │   │   └── VoiceChat/
│       │   ├── hooks/            # Custom React hooks
│       │   ├── stores/           # Zustand stores
│       │   ├── services/         # Socket.IO client, API calls
│       │   └── assets/           # Tile textures, sounds
│       └── package.json
├── docker-compose.yml
└── package.json            # Workspace root
```

---

## 4. Data Model

### 4.1 PostgreSQL Schema

```sql
-- Users
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Aggregate stats for registered users
CREATE TABLE user_stats (
    user_id       UUID PRIMARY KEY REFERENCES users(id),
    games_played  INT DEFAULT 0,
    games_won     INT DEFAULT 0,
    total_points  INT DEFAULT 0,
    highest_fan   INT DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Completed game records
CREATE TABLE games (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code     VARCHAR(20) NOT NULL,
    variant       VARCHAR(20) NOT NULL DEFAULT 'normal',  -- normal | skill | cracked
    started_at    TIMESTAMPTZ NOT NULL,
    ended_at      TIMESTAMPTZ,
    rounds_played INT DEFAULT 0
);

-- Per-player results within a game
CREATE TABLE game_players (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id     UUID REFERENCES games(id),
    user_id     UUID REFERENCES users(id),  -- NULL for guests
    seat_wind   VARCHAR(5),                 -- E/S/W/N
    final_score INT DEFAULT 0,
    is_winner   BOOLEAN DEFAULT false,
    guest_name  VARCHAR(100)               -- display name for guests
);
```

### 4.2 Redis Keys

| Key Pattern | Type | Purpose |
|-------------|------|---------|
| `room:{code}` | Hash | Room metadata (host, players, status) |
| `room:{code}:game` | String (JSON) | Serialized live game state |
| `room:{code}:chat` | List | Recent chat messages |

---

## 5. Real-Time Communication Protocol

All game events flow over Socket.IO. The server is the **single source of truth**; clients send intents, the server validates and broadcasts state updates.

### Key Events

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| C→S | `room:create` | callback `{ ok, room }` | Create a new room (host gets East seat) |
| C→S | `room:join` | `roomCode`, callback `{ ok, room }` | Join existing room |
| C→S | `room:leave` | — | Leave current room |
| S→C | `room:updated` | `Room` | Broadcast updated room state to all players |
| S→C | `room:error` | `message` | Error message for the requesting client |
| S→C | `session:displaced` | — | Notifies a tab that a newer tab has taken over the session |
| C→S | `game:start` | — | Host starts the game |
| S→C | `game:state` | `{ hand, discards, melds, wallCount, turnPlayer, ... }` | Full/delta state update (each player only sees their own hand) |
| C→S | `game:discard` | `{ tileId }` | Discard a tile |
| C→S | `game:claim` | `{ action: 'chow'|'pung'|'kong'|'win', tiles[] }` | Claim a discard |
| S→C | `game:actionPrompt` | `{ availableActions[] }` | Prompt player for possible claims |
| S→C | `game:roundEnd` | `{ winner, scores, fanDetails[] }` | Round results |
| S→C | `game:end` | `{ finalScores[] }` | Game over |
| C↔S | `voice:signal` | WebRTC signaling data | SDP/ICE exchange |

---

## 6. Game Engine Design

The game engine lives in `packages/common` and is used by both server and client.

### 6.1 State Machine

```
WAITING → DEALING → PLAYING → ROUND_END → (next round or GAME_END)
                      ↑                          │
                      └──────────────────────────┘
```

### 6.2 Turn Flow (PLAYING state)

```
DRAW_TILE
  → Player receives tile
  → Check for self-drawn win (自摸)
  → If win: → ROUND_END
  → Else: player must DISCARD

DISCARD_TILE
  → Tile placed on table
  → Other players checked for claims (priority: Win > Kong > Pung > Chow)
  → If claim: execute claim → claimer's turn (or ROUND_END if win)
  → If no claim after timeout: next player's turn → DRAW_TILE

WALL_EXHAUSTED
  → ROUND_END (draw game / 流局)
```

### 6.3 Scoring Engine

- Implements all 81 fan patterns from the Chinese Official rulebook.
- Input: winning hand (tiles + melds), win condition (self-drawn vs discard), seat/round wind.
- Output: list of matched fan patterns + total fan count + point value.
- Exclusion principle applied (higher patterns exclude lower overlapping ones).

---

## 7. Voice Chat Architecture

- **WebRTC** mesh topology (4 players = 6 peer connections).
- Signaling via the existing Socket.IO connection — no separate signaling server needed.
- STUN server for NAT traversal (use public Google STUN or self-hosted).
- Optional TURN server for restrictive networks (coturn, self-hosted).
- Audio only — no video.

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Tile visibility | Server never sends other players' hidden tiles to a client (except in 破解版 probability data) |
| Claim validation | Server validates every claim against actual game state |
| Auth | JWT with short expiry + refresh tokens; bcrypt for passwords |
| Room access | Room codes are random, unguessable (nanoid, 6 chars uppercase alpha) |
| Multi-tab abuse | One active socket per user; duplicate tabs are displaced server-side |
| Rate limiting | Express rate-limit on HTTP; Socket.IO event throttling |
| Input sanitization | Validate all socket payloads with zod schemas |

---

## 9. Scalability Path

**Phase 1–4 (single instance)**:
- One Node.js process handles rooms, game logic, and signaling.
- PostgreSQL + Redis on same host or managed services.

**Phase 5+ (multi-instance)**:
- Redis pub-sub for cross-instance room events.
- Sticky sessions via Redis adapter for Socket.IO.
- Horizontal scaling behind a load balancer (nginx / cloud LB).
- Database connection pooling (pgBouncer).

---

## 10. Phase-by-Phase Architecture Notes

### Phase 1 — Foundation
- Express server with Socket.IO.
- Room CRUD in Redis (JSON serialized, 2hr TTL).
- JWT auth (register + guest mode); guest tokens via `/api/auth/guest`.
- React app with Lobby UI, room creation, join-via-link.
- **Session displacement**: server tracks one active socket per user (`userSocketMap`). New connections emit `session:displaced` to the old socket before disconnecting it.
- **Socket-keyed room tracking**: room membership is keyed by `socketId` (not `userId`) so a displaced socket's disconnect does not remove the user from their room.
- **Host = East**: room creator is always seat 0 (East). On host departure, the new host is reassigned to seat 0.
- **Self-highlighting**: the current player's seat in the lobby is highlighted with a distinct border and "You" label.

### Phase 2 — Core Game

#### 2A — Tile System
- `packages/common/src/tiles.ts` — tile enum (`Wan1`–`Wan9`, `Tiao1`–`Tiao9`, `Tong1`–`Tong9`, 4 winds, 3 dragons, 4 seasons, 4 flowers), tile metadata (suit, rank, category), unique tile ID type.
- `createFullSet()` — returns 144 tiles with correct distribution (4× each standard tile, 1× each season/flower).
- `shuffle(tiles)` — Fisher-Yates shuffle returning a new array.

#### 2B — Game State & Deal
- `packages/common/src/game-state.ts` — canonical `GameState` type: wall, hands (per player), discards (per player), melds (per player), current turn, round wind, dealer, state machine phase.
- State machine: `WAITING → DEALING → PLAYING → ROUND_END → (next round or GAME_END)`.
- `deal(shuffledTiles)` — distributes 13 tiles to each player (14 to dealer), remaining tiles form the wall.
- Flower/season handling: if dealt a bonus tile, set it aside and draw replacement from wall end.
- Server persists live game state in Redis key `room:{code}:game`.
- Socket event: host emits `game:start` → server deals and emits `game:state` to each player (each player sees only their own hand + public info).

#### 2C — 3D Table & Live Hand ✅

First-person mahjong table view rendered in Three.js via React-Three-Fiber, with real-time hand broadcasting.

- **Scene**: `GameCanvas.tsx` (R3F Canvas, ACES tone mapping, shadows), `PerspectiveCamera` at (0,8,9) fov 45, `SceneLighting.tsx` (directional+ambient+point+hemisphere lights, 2048px shadow maps), `TableMesh.tsx` (10×10 felt plane + wood border/corners).
- **Tiles**: `TileMesh.tsx` (BoxGeometry 0.42×0.58×0.16, 6-face materials), `tileTextures.ts` (canvas-rendered 256px textures, cached). Standing/flat orientations, hover/select lift + emissive glow, raycaster interaction, castShadow/receiveShadow.
- **Hand layout**: `HandLayout.tsx` with `SIDE_CONFIGS` (bottom/top/left/right). `ViewerHand` (flat, click-to-select, drag-to-reorder with threshold gesture + gap animation). `OpponentHand` (standing, stable tileOrder keys for smooth lerp).
- **Broadcast**: Socket events (`game:tileSelected`, `game:tileDeselected`, `game:handReordered`, `game:tileDragging`) — server relays to room, no mutation. Only positional indices transmitted, never tile IDs or faces.
- **Overlays**: `TableOverlays.tsx` — player name labels (canvas texture on vertical PlaneGeometry, standing on wood border), center indicator (canvas texture on CircleGeometry with oriented wind characters, wall count, dealer badge), bonus tiles (scaled flat TileMesh with group-wrapper orientation per side).
- **Pages**: `RoomPage.tsx` mounts GameCanvas with HandLayout + TableOverlays when game active. `SceneDemoPage.tsx` at `/scene` with static and store-driven demo modes.

**Data model (`packages/common/src/types/events.ts`):**
- `TileSelectedPayload`: `{ seatIndex, tilePosition }`.
- `TileDeselectedPayload`: `{ seatIndex }`.
- `HandReorderedPayload`: `{ seatIndex, fromPosition, toPosition }`.
- `TileDraggingPayload`: `{ seatIndex, fromPosition, hoverPosition: number | null }`.

**Store (`OpponentHandState`):**
- `selectedPosition: number | null` — which tile position is raised.
- `dragging: { fromPosition, hoverPosition } | null` — live drag state.
- `tileOrder: number[]` — stable tile identities for smooth reorder animation.

#### 2D — Draw & Discard Loop
- Turn cycle: active player draws from wall → must discard one tile → turn passes to next player (E→S→W→N).
- Socket events: `game:draw` (S→C, tile drawn), `game:discard` (C→S, tile discarded), `game:state` (S→C, updated state after each action).
- Server validates all actions (can't discard a tile not in hand, can't act out of turn).
- Client: `DiscardPool` component (tiles discarded by each player, placed in center of table layout), `WallCounter` (remaining tiles). Click-to-discard on selected tile.
- Zustand `game-store.ts` for client game state (extends existing store).

#### 2E — Claims
- After a discard, other players may claim: chow (吃, next-in-turn only, sequential pair in hand), pung (碰, any player, pair in hand), kong (杠, any player, triplet in hand).
- Claim priority: win > kong > pung > chow. Ties broken by turn proximity.
- Kong variants: concealed kong (4 in hand), exposed kong (claim discard), promoted kong (add to existing pung). After kong, draw replacement tile.
- Server: claim window with timeout (e.g., 5s). Collect all claims, resolve priority, execute winner.
- Socket events: `game:actionPrompt` (S→C, available actions for a player), `game:claim` (C→S, player's chosen action).
- Client: `ActionPrompt` component (buttons for available claims: skip / chow / pung / kong / win).

#### 2F — Win Detection
- `packages/common/src/rules.ts` — `isWinningHand(tiles, melds)` returns boolean.
- Valid patterns: standard (4 melds + 1 pair), seven pairs (七对), thirteen orphans (十三幺).
- Win sources: self-drawn (自摸, draw from wall), discard win (点炮, claim another's discard).
- Minimum 8-fan gate: a valid hand shape below 8 fan cannot be declared as a win.
- Server checks win validity on every `game:claim` with action `win`.

#### 2G — Scoring Engine
- `packages/common/src/scoring.ts` — `scoreFan(hand, melds, winCondition, seatWind, roundWind)` returns `{ patterns: FanPattern[], totalFan: number, points: number }`.
- All 81 fan patterns implemented and individually tested.
- Exclusion principle: higher patterns suppress overlapping lower patterns (e.g., 大四喜 excludes 三风刻).
- Point computation from total fan value.
- Test fixtures in `packages/common/src/__fixtures__/hands/` — one fixture per fan pattern.

#### 2H — Round & Game Flow
- Round-end: winner's score computed, point deltas applied to all four players (winner gains, others pay).
- Draw game (流局): wall exhausted with no winner — no score change, re-deal.
- Score display: `ScoreBoard` component shows fan breakdown, point deltas, running totals.
- Next round: rotate dealer (or keep if dealer wins), re-shuffle, re-deal.
- Wind rotation: after each full cycle of 4 hands, round wind advances (E→S→W→N).
- Game-end condition: configurable number of rounds (default: 1 full wind cycle = 4+ hands).
- Socket events: `game:roundEnd` (S→C, round results + fan breakdown), `game:end` (S→C, final standings).

#### 2I — Timeout & Reconnection
- Turn timer: configurable per-action timeout (e.g., 15s for discard, 5s for claims). Server auto-discards a random tile if player times out.
- Client: `TurnTimer` component showing countdown.
- Reconnection: if a player disconnects mid-game, their socket re-joins on reconnect. Server sends full `game:state` to the reconnected player. Game continues (timer still runs for disconnected player).
- Graceful degradation: if a player is disconnected for too long, auto-play (discard drawn tile) until they return.

### Phase 3 — Polish & Social
- WebRTC voice chat integration.
- Three.js tween-based tile animations (draw, discard, claim, win).
- Three.js particle effects (confetti, sparkle on win/kong).
- Sound effects.
- In-game text chat.
- Mobile-responsive layout.

### Phase 4 — Persistence & Stats
- PostgreSQL schema deployment.
- Save game results on game end.
- User profile page with stats.
- Leaderboard.

### Phase 5 — Robot Players
- Rule-based AI (defensive/offensive heuristics).
- Configurable difficulty levels.
- Fill empty seats automatically or on demand.

### Phase 6 — 破解版 (Cracked)
- Server computes tile probabilities from remaining hidden tiles.
- Probability overlay on client showing win chance per pattern.
- Performance optimization (compute on discard, cache results).

### Phase 7 — 技能版 (Skill)
- Skill card definitions and balance.
- Modified game engine to handle skill effects.
- UI for skill activation and visual effects.
