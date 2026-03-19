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
| State management | Zustand | Lightweight, sufficient for game state |
| Styling | Tailwind CSS | Rapid UI development, responsive utilities |
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
│       │   │   ├── GameBoard/
│       │   │   ├── Hand/
│       │   │   ├── TileRenderer/
│       │   │   ├── ScoreBoard/
│       │   │   └── VoiceChat/
│       │   ├── hooks/            # Custom React hooks
│       │   ├── stores/           # Zustand stores
│       │   ├── services/         # Socket.IO client, API calls
│       │   └── assets/           # Tile images, sounds
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
| C→S | `room:create` | `{ variant }` | Create a new room |
| S→C | `room:created` | `{ roomCode, link }` | Room ready |
| C→S | `room:join` | `{ roomCode, displayName }` | Join existing room |
| S→C | `room:playerJoined` | `{ players[] }` | Broadcast updated player list |
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
| Room access | Room codes are random, unguessable (nanoid, 10 chars) |
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
- Room CRUD in Redis.
- JWT auth (register + guest mode).
- React app with Lobby UI, room creation, join-via-link.

### Phase 2 — Core Game
- Game engine in `packages/common`.
- Server-authoritative game loop.
- Tile rendering with SVG or sprite-based images.
- Turn management, claim priority resolution, timeout handling.
- Scoring engine (81 fan patterns).

### Phase 3 — Polish & Social
- WebRTC voice chat integration.
- Tile animations (draw, discard, claim).
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
