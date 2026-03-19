# Chinese Standard Mahjong Online

A web-based four-player Chinese Standard (国标) Mahjong game with real-time multiplayer, voice chat, and automatic scoring.

## Features

- **Room-based multiplayer** — Create a room and share a link with 3 other players
- **Full 144-tile set** — Including 东南西北中发白 and 春夏秋冬梅兰竹菊
- **Chinese Official scoring** — All 81 fan patterns, 8-fan minimum to win
- **Voice chat** — In-room audio communication via WebRTC
- **User history** — Win/loss records and leaderboard for registered users
- **Robot players** — Fill empty seats with AI opponents

## Game Variants

| Variant | Description |
|---------|-------------|
| 普通版 (Normal) | Standard Chinese Official rules |
| 技能版 (Skill) | Certain tiles are skill cards with special effects |
| 破解版 (Cracked) | All players see win probability hints based on hidden tile knowledge |

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Database**: PostgreSQL + Redis
- **Voice**: WebRTC (peer-to-peer)
- **Shared**: Game engine in TypeScript (monorepo)

## Development Phases

| Phase | Scope |
|-------|-------|
| 1. Foundation | Auth, rooms, lobby UI |
| 2. Core Game | Game engine, tile rendering, scoring |
| 3. Polish & Social | Voice chat, animations, sound |
| 4. Persistence | User stats, leaderboard, game history |
| 5. Robot Players | AI opponents with configurable difficulty |
| 6. 破解版 | Real-time win probability engine |
| 7. 技能版 | Skill card system |
| 8. UI Polish | Avatars, animations, dark mode, responsive design |

## Documentation

Detailed documentation is in the [`doc/`](doc/) folder:

- [Design](doc/01-design.md) — Product design, tile set, user flows, phased delivery
- [Architecture](doc/02-architecture.md) — Tech stack, project structure, data model, protocols
- [Testing](doc/03-testing.md) — Test strategy, per-phase test cases, coverage targets
- [Deployment](doc/04-deployment.md) — Local setup, Docker, CI/CD, infrastructure scaling
- [UI Design](doc/05-ui-design.md) — Visual design, layouts, animations, sound, assets

## License

TBD
