# UI Design Document — Chinese Standard Mahjong Online

> This document covers the visual design, layout, animations, and interaction polish applied as the final phase before mass deployment.

---

## 1. Design Principles

- **Clarity over decoration**: Every visual element serves gameplay. Players must instantly read tile faces, identify melds, and understand whose turn it is.
- **Cultural authenticity**: Color palette, typography, and tile art reference traditional Chinese mahjong aesthetics — warm wood tones, jade green felt, gold accents.
- **Responsive by default**: Layout adapts from 1920px desktop down to 768px tablet. Phone support (< 480px) via simplified portrait layout.
- **Accessible**: Minimum 4.5:1 contrast ratio on all tile text; colorblind-safe claim action buttons; keyboard navigation for tile selection.

---

## 2. Color Palette

| Token | Color | Hex | Usage |
|-------|-------|-----|-------|
| Felt Green | Dark jade | `#1a5c38` | Game table background |
| Wood | Warm brown | `#8b6914` | Table border, UI frame |
| Tile Face | Ivory | `#f5f0e1` | Tile background |
| Tile Back | Deep blue | `#1a3a5c` | Opponent hidden tiles |
| Gold Accent | Antique gold | `#c9a84c` | Highlights, win announcements |
| Red Accent | Lucky red | `#c0392b` | 中 tile, alerts, critical actions |
| Green Accent | Bamboo | `#27ae60` | 发 tile, confirm buttons |
| Text Primary | Off-black | `#2c2c2c` | General text |
| Text Secondary | Muted gray | `#7f8c8d` | Hints, secondary info |

---

## 3. Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Tile characters (万/条/筒/风/箭) | Noto Serif SC | 18–24px | Bold |
| UI headings | Noto Sans SC | 20–28px | Semi-bold |
| Body text | Noto Sans SC | 14–16px | Regular |
| Score numbers | JetBrains Mono | 16–24px | Bold |
| Fan pattern names | Noto Serif SC | 14px | Regular |

---

## 4. User Avatar System

### 4.1 Avatar Types

| Type | Description |
|------|-------------|
| Default | System-assigned animal icons (12 zodiac animals), randomly assigned to guests |
| Uploaded | Registered users upload a custom image (cropped to circle, max 512×512) |
| Preset gallery | 24 illustrated avatars with mahjong/Chinese cultural themes (dragon, phoenix, panda, lantern, etc.) |

### 4.2 Avatar Display Locations

| Location | Size | Shape | Extra |
|----------|------|-------|-------|
| Game table (player seat) | 64×64 | Circle | Glowing border when it's their turn |
| Lobby / room waiting | 48×48 | Circle | Online status dot (green/gray) |
| Leaderboard | 40×40 | Circle | Rank badge overlay (#1 gold, #2 silver, #3 bronze) |
| Profile page | 128×128 | Circle | Edit overlay on hover |
| Chat message | 32×32 | Circle | — |

### 4.3 Turn Indicator on Avatar

- Active player's avatar gets a **pulsing gold ring** animation (2s cycle).
- A small **arrow/spotlight** on the table points from the center toward the active player.

---

## 5. Game Table Layout

### 5.1 Desktop (landscape)

```
┌──────────────────────────────────────────────────────────┐
│  [Room Code]    [Voice: 🔊 🔇]    [Settings ⚙]         │
│                                                          │
│              ┌─────────────────────┐                     │
│              │  Opponent (top/北)  │                     │
│              │  [avatar] name  pts │                     │
│              │  ▓▓▓▓▓▓▓▓▓▓▓▓▓    │                     │
│              │  melds: [碰][碰]    │                     │
│              └─────────────────────┘                     │
│                                                          │
│  ┌──────────┐   ┌───────────────┐   ┌──────────┐       │
│  │Opp (左/西)│   │               │   │Opp (右/东)│       │
│  │[av] n pts│   │  DISCARD POOL │   │[av] n pts│       │
│  │ ▓        │   │               │   │        ▓ │       │
│  │ ▓        │   │  ┌──┬──┬──┐  │   │        ▓ │       │
│  │ ▓        │   │  │  │  │  │  │   │        ▓ │       │
│  │ melds    │   │  └──┴──┴──┘  │   │  melds   │       │
│  └──────────┘   └───────────────┘   └──────────┘       │
│                                                          │
│              ┌─────────────────────┐                     │
│              │     YOUR HAND       │                     │
│              │ [1万][2万][3条]...  │ ← selectable tiles  │
│              │                     │                     │
│              │  melds: [吃 1-3条]  │                     │
│              │  [avatar] name  pts │                     │
│              └─────────────────────┘                     │
│                                                          │
│  [Tiles left: 42]   [Fan hint]   [Chat 💬]             │
└──────────────────────────────────────────────────────────┘
```

- **Your hand** is at the bottom, tiles face-up, fully interactive.
- **Opponents' hands** are rendered as tile backs (▓), rotated to their respective sides.
- **Exposed melds** are shown face-up next to each player's hand.
- **Discard pool** is in the center, arranged in a grid (4 columns per player section).

### 5.2 Tablet / Small Screen

- Same layout, tiles and avatars scaled down.
- Side opponents' tiles are collapsed to a count indicator (e.g., "×11") instead of rendering individual backs.
- Discard pool scrollable if it overflows.

### 5.3 Mobile Portrait (< 480px)

- Your hand fills the bottom 40% of the screen.
- Opponents are represented as compact bars at top and sides (avatar + name + tile count + melds).
- Discard pool shown in a scrollable center area.
- Claim action buttons are large, thumb-friendly (bottom sheet overlay).

---

## 6. Tile Design

### 6.1 Tile Appearance

- 3D mesh: `BoxGeometry` rendered in Three.js via React-Three-Fiber.
- Material: `MeshStandardMaterial` per face — `roughness: 0.3`, `metalness: 0.05` for a ceramic sheen.
- Top face: tile face texture (canvas-rendered characters, upgradeable to SVG sprite atlas).
- Sides: ivory/cream with subtle edge wear.
- Back: solid deep blue/green with a traditional circular pattern texture.
- Real shadow casting onto the table surface via Three.js shadow maps.
- Specular highlights from directional lighting give tiles a physical, tactile feel.

### 6.2 Tile Face Rendering

| Category | Style |
|----------|-------|
| Wan (万) | Red Chinese numeral + 万 character |
| Tiao (条) | Green bamboo stick illustration |
| Tong (筒) | Blue/red circle pattern |
| Winds (东南西北) | Black bold character, centered |
| Dragons (中) | Red character on white |
| Dragons (发) | Green character on white |
| Dragons (白) | Empty tile with thin blue border (traditional blank tile) |
| Seasons (春夏秋冬) | Calligraphic character + small seasonal illustration, distinct color per tile |
| Flowers (梅兰竹菊) | Calligraphic character + small botanical illustration, distinct color per tile |

### 6.3 Tile States

| State | Visual Treatment |
|-------|-----------------|
| In hand (idle) | Normal position on table surface |
| Hovering | Tile lifts on Y axis + emissive glow |
| Selected (for discard) | Tile raised higher on Y axis + gold emissive highlight |
| Just drawn | Golden shimmer (emissive pulse animation), placed with gap to the right of existing hand |
| Discarded | Tween animation: lift → bezier arc → land in discard pool with slight bounce |
| In meld (exposed) | Grouped together, slightly smaller scale |
| Claimed tile (in meld) | Rotated 90° to indicate it came from another player |
| Flower/Season (set aside) | Displayed in a dedicated bonus area near the player's seat |

---

## 7. Animations

### 7.1 Tile Animations

| Action | Animation | Duration | Easing |
|--------|-----------|----------|--------|
| **Draw tile** | Tile rises from wall, flips to reveal face, slides into hand with easing; golden emissive shimmer on arrival | 400ms | ease-out |
| **Discard** | Tile lifts from hand, follows bezier arc to discard pool, lands with slight bounce + shadow | 500ms | cubic-bezier(0.2, 0.8, 0.3, 1) |
| **Chow (吃)** | Claimed tile slides from discard pool to claimer's meld area; two tiles from hand slide out to join; snap together with flash | 600ms | ease-in-out |
| **Pung (碰)** | Same as chow but with two tiles from hand; brief red emissive flash on the meld | 600ms | ease-in-out |
| **Kong (杠)** | Four tiles converge into a stack; dramatic golden flash + particle sparkle ring | 700ms | ease-in-out |
| **Concealed Kong** | Four tiles in hand flip face-down, slide together, emissive glow | 700ms | ease-in-out |
| **Flower/Season reveal** | Tile drawn → brief pause face-up in center → slides to bonus area → replacement tile drawn from wall end | 800ms total | ease-in-out |

### 7.2 Claim Action UI

When a tile is discarded and the player has valid claims:

```
┌─────────────────────────────────────────┐
│                                         │
│  The discarded tile floats briefly      │
│                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌────┐ │
│  │  吃  │  │  碰  │  │  杠  │  │ 胡 │ │
│  │ Chow │  │ Pung │  │ Kong │  │Win │ │
│  └──────┘  └──────┘  └──────┘  └────┘ │
│                                         │
│              ┌──────┐                   │
│              │  过  │                   │
│              │ Pass │                   │
│              └──────┘                   │
│                                         │
└─────────────────────────────────────────┘
```

- Buttons slide up from bottom with stagger (50ms each).
- Available actions are highlighted; unavailable ones are hidden (not grayed out — reduce clutter).
- **胡 (Win)** button is gold with a pulsing glow to ensure it's never missed.
- **Countdown timer** (5–10 seconds) shown as a circular progress ring around the action prompt. Auto-pass on timeout.
- Buttons are large touch targets (min 48×48px).

### 7.3 Win Announcement

When a player wins:

1. **Screen dim** — table darkens to 40% opacity (300ms fade).
2. **Camera zoom** — camera smoothly zooms to winner's hand position.
3. **Winning hand reveal** — tiles fly to center of screen and arrange face-up in a row (600ms).
4. **Particle burst** — gold/red confetti burst (Three.js `Points` or instanced meshes, 1.5s).
5. **Fan banner** — a scrolling golden banner (HTML overlay) unfurls listing each matched fan pattern with its point value:
   ```
   ╔══════════════════════════════════╗
   ║          🀄  胡了!  🀄           ║
   ║                                  ║
   ║   清一色        24 番            ║
   ║   门前清         2 番            ║
   ║   自摸           1 番            ║
   ║   ───────────────────            ║
   ║   总计:         27 番            ║
   ║   得分:        +108 分           ║
   ╚══════════════════════════════════╝
   ```
6. **Score update** — player scores in the scoreboard animate from old value to new value (counter roll-up, 800ms).
7. **Continue button** — appears after 3 seconds: "下一局 / Next Hand".

### 7.4 Draw Game (流局)

1. Screen dims slightly.
2. Remaining wall tiles scatter gently outward.
3. Text overlay: "流局 — Draw" with muted styling (no celebration).
4. Score summary (if any penalties apply).

### 7.5 Skill Card Animations (技能版)

| Skill | Animation |
|-------|-----------|
| **Blind (遮眼)** | Target players' screens get a fog/blur overlay that fades in. Their tile faces become obscured tile-back patterns. Lifts after N turns with a dissolve. |
| **Peek (透视)** | Activating player sees a brief X-ray ripple effect across the wall; a few upcoming wall tiles are briefly revealed with a glowing outline. |
| **Swap (交换)** | A tile from the player's hand floats up, flies across the table to the target player, and a tile flies back. Both land with a flash. |
| **Shield (护盾)** | A translucent dome/barrier appears over the player's tile area for the duration. Incoming skill effects bounce off with a spark. |
| **Generic activation** | Skill card rises from hand → enlarges to center screen with a dramatic radial burst → effect name displayed → card shatters into particles → effect applies. Total: 1.2s. |

Skill cards in hand are visually distinct from regular tiles — **slightly larger, colored border (purple/gradient), and an icon** instead of a tile face.

### 7.6 Transition & Micro-Animations

| Element | Animation |
|---------|-----------|
| Turn change | Active player's seat area gets a subtle glow sweep (left-to-right, 300ms) |
| Score change | Numbers roll up/down with a counter animation |
| Player join (lobby) | Avatar slides in from right, name fades in |
| Player disconnect | Avatar grays out, "reconnecting..." pulse |
| Room countdown (game start) | Large center "3... 2... 1..." with scale-down + fade |
| Chat message | Slides in from bottom-right, auto-dismiss after 5s |
| Voice activity | Avatar border pulses green when the player is speaking |
| Tile sort (auto-arrange hand) | Tiles shuffle to sorted positions simultaneously (300ms) |

---

## 8. 破解版 (Cracked) Hint Overlay

### 8.1 Probability Display

After each discard, each player sees a **hint panel** (collapsible sidebar or overlay):

```
┌─────────────────────────────┐
│  📊 Win Probability Hints   │
│                             │
│  清一色 (清筒)        12.3% │  ██████░░░░
│  碰碰和              8.7%  │  ████░░░░░░
│  混一色              6.1%  │  ███░░░░░░░
│  平和                4.2%  │  ██░░░░░░░░
│  ...                       │
│                             │
│  Overall win chance: 23.5%  │
│  Turns to tenpai:  ~3       │
└─────────────────────────────┘
```

- Progress bars color-coded: green (> 20%), yellow (5–20%), red (< 5%).
- **Tile recommendation**: tiles in hand that contribute least to any winning pattern get a subtle red underline. Best discard gets a green highlight.
- Panel animates probabilities smoothly when values change (bar width transition, 300ms).

---

## 9. Lobby & Room UI

### 9.1 Home / Lobby Screen

```
┌──────────────────────────────────────────────┐
│  🀄 Chinese Mahjong Online                   │
│                                              │
│  [avatar]  Welcome, Player Name              │
│            Rank: 1500  |  Games: 42          │
│                                              │
│  ┌────────────┐  ┌────────────┐              │
│  │  创建房间   │  │  加入房间   │              │
│  │ Create Room │  │ Join Room  │              │
│  └────────────┘  └────────────┘              │
│                                              │
│  Mode:  ○ 普通版  ○ 破解版  ○ 技能版         │
│                                              │
│  ─── Recent Games ───                        │
│  2026-03-17  Room abc123  +45 pts  W         │
│  2026-03-16  Room def456  -12 pts  L         │
│                                              │
│  ─── Leaderboard (Top 10) ───                │
│  🥇  DragonMaster    4,520 pts               │
│  🥈  MahjongPro      3,890 pts               │
│  🥉  TileKing        3,210 pts               │
│                                              │
│  [Profile]  [History]  [Settings]            │
└──────────────────────────────────────────────┘
```

### 9.2 Room Waiting Screen

```
┌──────────────────────────────────────────────┐
│  Room: ABC123          Mode: 普通版           │
│  Share link: [https://...../room/ABC123] 📋  │
│                                              │
│  ┌─────────┐  ┌─────────┐                   │
│  │ [avatar] │  │ [avatar] │                   │
│  │  Host 👑 │  │ Player 2 │                   │
│  │  Ready ✓ │  │  Ready ✓ │                   │
│  └─────────┘  └─────────┘                   │
│  ┌─────────┐  ┌─────────┐                   │
│  │ [avatar] │  │         │                   │
│  │ Player 3 │  │ Waiting │                   │
│  │  Ready ✓ │  │  ...    │                   │
│  └─────────┘  └─────────┘                   │
│                                              │
│  [Add Robot 🤖]     [Start Game ▶]           │
│                      (enabled when 4 ready)  │
│                                              │
│  🔊 Voice Chat: ON       [🔇 Mute]          │
└──────────────────────────────────────────────┘
```

---

## 10. Scoreboard (In-Game)

Persistent compact scoreboard in the corner during play:

```
┌────────────────────┐
│  东 PlayerA   +45  │  ← current dealer highlighted
│  南 PlayerB   -12  │
│  西 PlayerC   +30  │
│  北 PlayerD   -63  │
│  ──────────────    │
│  Round: 东风 2局   │
│  Wall: 42 tiles    │
└────────────────────┘
```

- Expandable on click to show per-round breakdown.
- Score changes animate in-place on round end.

---

## 11. Sound Design

| Event | Sound |
|-------|-------|
| Tile draw | Soft click (tile lifted from wall) |
| Tile discard | Tile-on-felt thud |
| Chow/Pung/Kong | Sharper tile clack + a subtle voice callout ("吃" / "碰" / "杠") |
| Win declared | Triumphant chime + voice ("胡了!") |
| Skill card activation | Magical whoosh + card-specific sound |
| Player joins room | Soft chime |
| Turn timer warning (< 3s) | Ticking clock |
| Chat message | Subtle pop |

All sounds have a **volume slider** and **mute toggle** in settings. Sounds are off by default on mobile to respect device context.

---

## 12. Dark Mode

An optional dark mode for late-night sessions:

| Element | Light | Dark |
|---------|-------|------|
| Table | `#1a5c38` jade green | `#0d2e1c` deep forest |
| UI chrome | `#f5f0e1` ivory | `#1e1e2e` dark navy |
| Tile face | `#f5f0e1` ivory | `#e8e0d0` warm off-white (tiles stay light for readability) |
| Text | `#2c2c2c` | `#e0e0e0` |
| Accents | Same gold/red | Same gold/red (pop more on dark) |

---

## 13. Implementation Phasing (UI-Specific)

This doc represents the **final polish phase** before mass deployment. The UI work breaks down as:

| Sub-Phase | Work | Depends On |
|-----------|------|-----------|
| 8a. Visual Foundation | Color palette, typography, tile art assets, avatar system, dark mode | Phase 2 (basic game working) |
| 8b. Layout & Responsiveness | Game table layout for desktop/tablet/mobile, lobby screens, scoreboard | Phase 2 |
| 8c. Core Animations | Draw, discard, chow/pung/kong, win announcement, turn indicator | Phase 2 |
| 8d. Social Polish | Voice activity indicator, chat UI, player join/leave transitions | Phase 3 |
| 8e. Cracked Mode UI | Probability panel, tile recommendation highlights | Phase 6 |
| 8f. Skill Mode UI | Skill card rendering, activation animation, effect overlays | Phase 7 |
| 8g. Final QA | Cross-browser animation testing, mobile performance, accessibility audit | All above |

---

## 14. Asset Requirements

| Asset | Format | Quantity |
|-------|--------|---------|
| Tile face images | SVG (scalable) | 42 unique faces (9×3 suits + 4 winds + 3 dragons + 4 seasons + 4 flowers) |
| Tile back | SVG | 1 |
| Avatar presets | PNG/SVG (512×512) | 24 |
| Skill card illustrations | SVG | TBD (one per skill type) |
| Sound effects | MP3 + OGG | ~15 clips |
| Particle textures | PNG (small) | 3–4 (confetti, sparkle, smoke) |
| Fonts | WOFF2 | 3 families (Noto Serif SC, Noto Sans SC, JetBrains Mono) |
