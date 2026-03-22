# Design Document — Chinese Standard Mahjong Online

## 1. Product Overview

A web-based four-player Chinese Standard (国标) Mahjong game supporting real-time multiplayer, voice chat, score computation, user history, and three game variants.

---

## 2. Game Variants

| Variant | Chinese | Description |
|---------|---------|-------------|
| Normal | 普通版 | Standard Chinese Official rules, no modifications. **Built first.** |
| Skill | 技能版 | Certain tiles are replaced with skill cards (e.g., blind opponents for one round, peek at the wall, swap a tile with another player). Skill card design is TBD. |
| Cracked | 破解版 | All players receive real-time probability hints showing their chance of completing specific winning patterns, computed from knowledge of remaining hidden tiles. |

---

## 3. Tile Set (Chinese Standard / 国标)

| Category | Tiles | Count |
|----------|-------|-------|
| Suited — Wan (万) | 1–9 | ×4 each = 36 |
| Suited — Tiao (条) | 1–9 | ×4 each = 36 |
| Suited — Tong (筒) | 1–9 | ×4 each = 36 |
| Winds (风) | 东 南 西 北 | ×4 each = 16 |
| Dragons (箭) | 中 发 白 | ×4 each = 12 |
| Seasons (季) | 春 夏 秋 冬 | ×1 each = 4 |
| Flowers (花) | 梅 兰 竹 菊 | ×1 each = 4 |
| **Total** | | **144** |

Seasons and Flowers are bonus tiles — drawn and immediately set aside, replaced by drawing from the back of the wall.

---

## 4. Core User Flows

### 4.1 Room Creation & Joining
1. Any user (registered or guest) clicks **Create Room**.
2. System generates a unique room with a shareable link (e.g., `https://app/room/abc123`).
3. Three other players open the link and join the room.
4. Once four players are present, the host can start the game.
5. If fewer than four humans are available, empty seats can be filled with **robot players** (Phase 5).
6. **One active tab per user**: Only one browser tab may hold an active socket connection per user. Opening a second tab displaces the first (shows a "Session opened in another tab" notice with a Reconnect option). Incognito windows use separate guest accounts and are unaffected.

### 4.1.1 Seat Assignment
- The room host is always assigned the **East seat** (seat index 0).
- Other players fill the next available seat (South → West → North) in order.
- If the host leaves, the next player becomes host and is reassigned to the East seat.
- In the room lobby, the current player's seat is visually highlighted (yellow border + "You" label) so they can identify themselves. The "Host" badge is yellow in the host's own view and green in other players' views. Player names are always white.

### 4.2 Gameplay Loop (per hand)
1. **Shuffle & Deal** — 144 tiles shuffled; each player receives 13 tiles (dealer gets 14).
2. **Draw → (Action) → Discard** cycle:
   - Active player draws from the wall.
   - May declare Chow (吃), Pung (碰), Kong (杠), or Win (胡).
   - Discards one tile.
3. Other players may intercept a discard (Pung/Kong/Win take priority over Chow).
4. Hand ends when a player wins or the wall is exhausted (draw/流局).

### 4.3 Scoring
- Chinese Official scoring: 81 recognized fan (番) patterns.
- Minimum 8 fan required to declare a win.
- At hand end the server computes each player's score delta.
- Running totals maintained per room session.

### 4.4 Voice Chat
- Players in the same room can communicate via real-time audio.
- Mute/unmute controls per player.
- Voice is room-scoped — no cross-room audio.

### 4.5 User History
- **Registered users**: win/loss record, total points, game count persisted to their profile.
- **Guest users**: stats shown only during the room session; not persisted.

---

## 5. Phased Delivery Plan

| Phase | Name | Scope | Goal |
|-------|------|-------|------|
| 1 | Foundation | Room creation/joining, basic lobby UI, user auth (register + guest) | Players can create, share, and join rooms |
| **2** | **Core Game** | **Full 普通版 game engine (sub-steps below)** | **Playable four-player game** |
| 2A | Tile System | Tile types/enums, 144-tile set generation, shuffle | Tiles can be created and randomized |
| 2B | Game State & Deal | Game state machine, wall, dealing 13/14 tiles, flower/season replacement | Game can start and deal hands |
| 2C | Draw & Discard Loop | Basic turn cycle (draw → discard → next player), game board UI, tile rendering | Players can take turns drawing and discarding |
| 2D | Claims | Chow (吃), pung (碰), kong (杠) logic, claim priority resolution, action prompt UI | Players can claim discards to form melds |
| 2E | Win Detection | Valid hand checking (4 melds + pair, seven pairs, thirteen orphans), self-drawn & discard win, minimum 8-fan gate | Players can declare and win |
| 2F | Scoring Engine | All 81 fan patterns, exclusion principle, point computation | Winning hands are scored correctly |
| 2G | Round & Game Flow | Round-end settlement, score display, next-round dealing, wind rotation, game-end condition | Full multi-round game sessions |
| 2H | Timeout & Reconnection | Auto-discard timer, player reconnection with state recovery | Robust handling of slow/disconnected players |
| 3 | Polish & Social | Voice chat (WebRTC), animations, sound effects, responsive UI, chat | Complete social experience |
| 4 | Persistence & Stats | User history, leaderboard, game replay storage | Long-term engagement |
| 5 | Robot Players | AI opponents with configurable difficulty | Play with fewer than 4 humans |
| 6 | 破解版 (Cracked) | Real-time probability engine, hint UI overlay | Advanced analytical mode |
| 7 | 技能版 (Skill) | Skill card design, integration into game engine, balance testing | Fun/party mode |
| 8 | UI Polish | Visual design, tile art, avatars, animations (吃/碰/杠/胡/skill cards), sound, dark mode, responsive layout, accessibility audit | Mass deployment ready |

Each phase is detailed in the architecture and test documents.

---

## 6. Non-Functional Requirements

- **Latency**: Game actions reflected in < 200 ms for all players.
- **Concurrency**: Support ≥ 100 simultaneous rooms at launch.
- **Browser support**: Latest Chrome, Firefox, Safari, Edge.
- **Mobile**: Responsive design; playable on tablets and large phones.
- **Accessibility**: Keyboard navigation for tile selection; screen-reader labels for tiles.
- **Localization**: Chinese (primary), English (secondary).

---

## 7. Out of Scope (for now)

- Monetization / in-app purchases.
- Spectator mode.
- Tournament bracket system.
- Native mobile apps (PWA only).
