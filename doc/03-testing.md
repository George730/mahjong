# Testing Document — Chinese Standard Mahjong Online

## 1. Testing Strategy Overview

```
                    ┌─────────────────┐
                    │   E2E Tests     │  ← Few, high-value user journeys
                    │  (Playwright)   │
                ┌───┴─────────────────┴───┐
                │   Integration Tests     │  ← API + Socket.IO + DB
                │   (Vitest + Supertest)  │
            ┌───┴─────────────────────────┴───┐
            │       Unit Tests                │  ← Game engine, scoring, utils
            │       (Vitest)                  │
            └─────────────────────────────────┘
```

- **Unit tests** — fast, isolated, cover game logic exhaustively.
- **Integration tests** — verify server endpoints, socket events, database operations.
- **E2E tests** — simulate real browser sessions for critical flows.
- **Test runner**: Vitest (all packages); Playwright (E2E).
- **CI**: All tests run on every PR. E2E runs nightly + before release.

---

## 2. Phase 1 — Foundation

### Unit Tests

| Area | Test Cases |
|------|-----------|
| Auth | Password hashing/verification; JWT creation/validation/expiry; guest token generation |
| Room | Room code generation uniqueness; room state transitions (waiting → full → started) |

### Integration Tests

| Area | Test Cases |
|------|-----------|
| Auth API | `POST /auth/register` — success, duplicate username, weak password |
| Auth API | `POST /auth/login` — success, wrong password, unknown user |
| Auth API | `POST /auth/guest` — returns valid guest token |
| Room Socket | `room:create` → receive `room:created` with valid code |
| Room Socket | `room:join` → all clients receive `room:playerJoined` |
| Room Socket | Join full room → error |
| Room Socket | Join non-existent room → error |
| Room Socket | Host disconnects → room cleanup or host transfer |

### E2E Tests

| Test | Steps |
|------|-------|
| Create & join room | User A creates room → copies link → User B/C/D open link → all see 4 players in lobby |

---

## 3. Phase 2 — Core Game

### Unit Tests — Tile System

| Area | Test Cases |
|------|-----------|
| Tile set | Full set contains exactly 144 tiles with correct distribution |
| Tile set | Seasons (春夏秋冬) appear exactly once each |
| Tile set | Flowers (梅兰竹菊) appear exactly once each |
| Tile set | Each suited tile (wan/tiao/tong 1–9) appears exactly 4 times |
| Tile set | Each wind (东南西北) appears exactly 4 times |
| Tile set | Each dragon (中发白) appears exactly 4 times |
| Shuffle | Shuffled set has same 144 tiles (different order) |

### Unit Tests — Game State

| Area | Test Cases |
|------|-----------|
| Deal | Each player receives 13 tiles; dealer receives 14 |
| Deal | Dealing removes exactly 53 tiles from wall |
| Wall | Wall has 91 tiles after deal (144 - 53) |
| Turn order | Turns cycle E → S → W → N → E |
| Flower/Season draw | Drawing a bonus tile triggers replacement from wall end |

### Unit Tests — Actions

| Area | Test Cases |
|------|-----------|
| Discard | Player can only discard a tile in their hand |
| Discard | After discard, hand size decreases by 1 |
| Chow (吃) | Only the next-in-turn player can chow |
| Chow | Requires two matching sequential tiles in hand |
| Chow | Chow creates a meld and reduces hand by 2 |
| Pung (碰) | Any non-active player can pung |
| Pung | Requires two matching tiles in hand |
| Kong (杠) | Concealed kong: 4 of same tile in hand |
| Kong | Exposed kong: hold 3, claim 4th from discard |
| Kong | Promoted kong: add 4th tile to existing pung |
| Kong | After kong, player draws replacement tile |
| Claim priority | Win > Kong > Pung > Chow |
| Claim priority | Multiple pung claims → closest in turn order wins |

### Unit Tests — Win Detection

| Area | Test Cases |
|------|-----------|
| Valid win | Standard 4 melds + 1 pair |
| Valid win | Seven pairs (七对) |
| Valid win | Thirteen orphans (十三幺) |
| Invalid win | 13 tiles with no valid grouping |
| Minimum fan | Win with exactly 8 fan → valid |
| Minimum fan | Win with 7 fan → invalid (below minimum) |
| Self-drawn win | 自摸 correctly identified |
| Discard win | 点炮 correctly identified |

### Unit Tests — Scoring Engine (81 Fan Patterns)

This is the most critical test suite. Each of the 81 recognized fan patterns must be tested.

| Fan Value | Example Patterns to Test |
|-----------|------------------------|
| 88 fan | 大四喜, 大三元, 九莲宝灯, 四杠, 连七对, 十三幺 |
| 64 fan | 小四喜, 小三元, 字一色, 四暗刻, 一色双龙会 |
| 48 fan | 一色四同顺, 一色四节高 |
| 32 fan | 一色四步高, 三杠, 混幺九 |
| 24 fan | 七对, 七星不靠, 全双刻, 清一色, 一色三同顺, 一色三节高, 全大, 全中, 全小 |
| 16 fan | 清龙, 三色双龙会, 一色三步高, 全带五, 三同刻, 三暗刻 |
| 12 fan | 全不靠, 组合龙, 大于五, 小于五, 三风刻 |
| 8 fan | 妙手回春, 海底捞月, 杠上开花, 抢杠胡, 混一色, etc. |
| 6 fan | 碰碰和, 混一色, 全求人, 双暗杠, 双箭刻 |
| 4 fan | 全带幺, 不求人, 双明杠, 和绝张 |
| 2 fan | 箭刻, 圈风刻, 门风刻, 门前清, 平和, 四归一, 双同刻, 双暗刻, 暗杠, 断幺 |
| 1 fan | 一般高, 喜相逢, 连六, 老少副, 幺九刻, 明杠, 缺一门, 无字, 边张, 坎张, 单钓将, 自摸 |

Test strategy:
- One test per fan pattern with a hand that matches **only** that pattern.
- Combination tests: hands that match multiple patterns; verify correct exclusion rules.
- Edge cases: hands near the boundary of two similar patterns.

### Integration Tests

| Area | Test Cases |
|------|-----------|
| Game flow | Start game → deal → full round of draw/discard → win → scores computed |
| Reconnection | Player disconnects mid-game → reconnects → receives current state |
| Timeout | Player doesn't act within time limit → auto-discard triggered |
| Invalid action | Client sends illegal discard → server rejects |

### E2E Tests

| Test | Steps |
|------|-------|
| Full hand | 4 browser sessions play through a complete hand to completion |
| Claim interaction | Player discards → another player pungs → verify turn order updates |

---

## 4. Phase 3 — Polish & Social

### Unit Tests

| Area | Test Cases |
|------|-----------|
| Chat | Message sanitization (XSS prevention) |
| Chat | Message length limits |

### Integration Tests

| Area | Test Cases |
|------|-----------|
| Voice signaling | SDP offer/answer relayed correctly via socket |
| Voice signaling | ICE candidates forwarded to correct peer |
| Voice | Player mute state broadcast to others |

### E2E Tests

| Test | Steps |
|------|-------|
| Voice chat | Two browsers establish audio connection (verify ICE connection state) |
| Responsive | Game board renders correctly at 1920px, 1024px, 768px widths |

---

## 5. Phase 4 — Persistence & Stats

### Integration Tests

| Area | Test Cases |
|------|-----------|
| Game save | On game end, game record + player results written to PostgreSQL |
| Guest exclusion | Guest player results not written to user_stats |
| User stats | After game, registered user's games_played/games_won/total_points updated |
| Leaderboard | Top N users returned sorted by total_points |
| Concurrent writes | Two games ending simultaneously → no race condition in stats update |

### E2E Tests

| Test | Steps |
|------|-------|
| History page | Register → play a game → navigate to profile → see game in history |

---

## 6. Phase 5 — Robot Players

### Unit Tests

| Area | Test Cases |
|------|-----------|
| AI discard | Robot discards a tile within time limit |
| AI claim | Robot claims when beneficial (e.g., completes a meld toward winning hand) |
| AI defense | Robot avoids discarding tiles likely to let others win (higher difficulty) |
| AI difficulty | Easy AI makes random-ish choices; hard AI uses heuristics |
| AI fill | Room with 2 humans + 2 robots plays to completion |

### Integration Tests

| Area | Test Cases |
|------|-----------|
| Robot seat fill | Request robot fill → game state includes robot players |
| Robot timing | Robot actions occur with human-like delays (not instant) |

---

## 7. Phase 6 — 破解版 (Cracked)

### Unit Tests

| Area | Test Cases |
|------|-----------|
| Probability engine | Given known remaining tiles, correctly computes chance for specific patterns |
| Probability engine | Edge case: only 1 tile needed → correct probability |
| Probability engine | All tiles visible → probability is 0 or 1 |
| Hint generation | Generates top-N most probable winning patterns |

### Integration Tests

| Area | Test Cases |
|------|-----------|
| Hint delivery | After each discard, updated hints sent to all players |
| Performance | Probability computation completes in < 100 ms for typical game state |

---

## 8. Phase 7 — 技能版 (Skill)

### Unit Tests

| Area | Test Cases |
|------|-----------|
| Skill activation | Skill card played → effect applied to game state |
| Skill: blind | Target players cannot see new tiles for N turns |
| Skill timing | Skills can only be used on player's turn |
| Skill balance | Player can hold at most N skill cards |

### Integration Tests

| Area | Test Cases |
|------|-----------|
| Skill broadcast | Skill activation visible to all players |
| Skill interaction | Two conflicting skills → correct priority resolution |

---

## 9. Test Data & Fixtures

Maintain a library of pre-built hands in `packages/common/src/__fixtures__/`:

```
hands/
├── winning/
│   ├── basic-win.ts          # Simple 4 melds + pair
│   ├── seven-pairs.ts        # 七对
│   ├── thirteen-orphans.ts   # 十三幺
│   ├── all-honors.ts         # 字一色
│   └── ...                   # One per major fan pattern
├── losing/
│   ├── no-valid-grouping.ts
│   ├── below-minimum-fan.ts
│   └── ...
└── edge-cases/
    ├── multiple-win-choices.ts
    ├── simultaneous-claims.ts
    └── ...
```

---

## 10. Coverage Targets

| Package | Line Coverage Target |
|---------|---------------------|
| `packages/common` (game engine) | ≥ 95% |
| `packages/server` | ≥ 80% |
| `packages/client` | ≥ 70% |

The game engine and scoring are the highest-risk components and demand the highest coverage.
