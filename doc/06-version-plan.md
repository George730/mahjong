# Version Plan — Chinese Standard Mahjong Online

This document defines the rendering strategy and maps existing phases to the implementation plan. The project uses **Three.js (via React-Three-Fiber)** from the start for a Mahjong Soul-class 3D experience.

---

## Rendering Technology

| Aspect | Implementation |
|--------|---------------|
| **Rendering** | WebGL via Three.js + React-Three-Fiber (R3F) |
| **Tile visuals** | 3D box meshes with painted texture maps |
| **Lighting** | Real-time directional + ambient lights, specular highlights |
| **Shadows** | Shadow maps cast by tiles onto the table |
| **Table** | 3D plane with PBR felt/wood materials |
| **Perspective** | Single 3D camera with true vanishing point across entire scene |
| **Animations** | Three.js clock-driven animations (+ optional Tween.js for easing) |
| **Particles** | Three.js particle systems (confetti, sparkle, smoke) |
| **Performance** | GPU-accelerated; handles thousands of objects |
| **Browser support** | Requires WebGL (99%+ of modern browsers) |

---

## Dependencies (3D Rendering)

| Package | Purpose |
|---------|---------|
| `three` | Core 3D rendering engine |
| `@types/three` | TypeScript definitions |
| `@react-three/fiber` | React renderer for Three.js (declarative scene graph, hooks for game store) |
| `@react-three/drei` | Helpers: `Environment`, `Shadow`, `Html` (for overlays), etc. |
| `@tweenjs/tween.js` (optional) | Smooth animation easing (alternative: Three.js `Clock` + manual interpolation) |

---

## Phase Map

| Phase | Name | Scope | Status |
|-------|------|-------|--------|
| 1 | Foundation | Auth (register + guest), room creation/joining, lobby UI, shareable links, session displacement | Done |
| 2A | Tile System | Tile types/enums, 144-tile set generation, Fisher-Yates shuffle | Done |
| 2B | Game State & Deal | State machine (WAITING → DEALING → PLAYING → ROUND_END), wall, dealing 13/14, flower/season replacement | Done |
| 2C-1 | Scene Foundation | Install Three.js/R3F@8/drei@9, `GameCanvas.tsx`, PerspectiveCamera, `SceneLighting` (directional+ambient+point+hemisphere, shadow maps, tone mapping), `TableMesh` (felt + wood border + corners) | Done |
| 2C-2 | Tile Mesh System | `TileMesh.tsx` (BoxGeometry + 6-face materials), `tileTextures.ts` (canvas-rendered face/back/side textures, cached), tile orientation (standing upright or flat face-up), hover/select lift + emissive glow, raycaster interaction | Done |
| 2C-3 | Hand Layout & Interaction | Extract layout from demo into `HandLayout.tsx`, wire to Zustand game-store, tile selection via store, drag-to-reorder in 3D | |
| 2C-4 | Table Layout & HTML Overlays | Player labels via `<Html>`, bonus tile groups, discard pool placeholder, turn indicator, scoreboard overlay | |
| 2C-5 | Game Board Integration | Replace CSS 3D `GameBoard.tsx` with Three.js `GameCanvas`, wire `RoomPage` to mount 3D scene when game active | |
| 2C-6 | Broadcast & Sync | Wire socket broadcasts (select/deselect/reorder/drag) to 3D tile state, opponent highlight effects | |
| 2D | Draw & Discard Loop | Turn cycle (draw → discard → next), discard pool in center, wall counter, click-to-discard | |
| 2E | Claims | Chow/pung/kong logic, claim priority resolution, action prompt UI, claim window timer | |
| 2F | Win Detection | Valid hand check (4 melds + pair, seven pairs, thirteen orphans), self-drawn & discard win, 8-fan gate | |
| 2G | Scoring Engine | All 81 fan patterns, exclusion principle, point computation | |
| 2H | Round & Game Flow | Round-end settlement, score display, wind rotation, next-round dealing, game-end condition | |
| 2I | Timeout & Reconnection | Auto-discard timer, player reconnection with state recovery | |
| 3 | Polish & Social | Voice chat (WebRTC), Three.js animations for draw/discard/claim/win, sound effects, responsive layout, chat | |
| 4 | Persistence & Stats | PostgreSQL game records, user profile/history, leaderboard | |
| 5 | Robot Players | Rule-based AI opponents, configurable difficulty, fill empty seats | |
| 6 | Cracked Mode (破解版) | Real-time probability engine, hint UI overlay on 3D scene | |
| 7 | Skill Mode (技能版) | Skill card design, 3D skill card rendering, effect animations (fog, X-ray, swap flight paths) | |
| 8 | Final UI Polish | Tile art assets, avatars, character portraits, dark mode, accessibility audit, mobile optimization | |

---

## Phase 2C Detailed Breakdown

### 2C-1: Scene Foundation ✅
- Installed `three`, `@react-three/fiber@8`, `@react-three/drei@9`, `@types/three` (React 18 compatible)
- `GameCanvas.tsx` — R3F `<Canvas>` with ACES filmic tone mapping, antialiasing, shadow support
- `PerspectiveCamera` at `(0, 8, 9)`, fov 45, looking down at ~41° angle
- `SceneLighting.tsx` — `DirectionalLight` from above `(0, 10, 0)` with 2048px shadow maps, `AmbientLight` (warm fill), `PointLight` at center (warm glow), `HemisphereLight` (sky/ground); optional debug helper
- `TableMesh.tsx` — `PlaneGeometry` with PBR felt material (`#1a5c38`, roughness 0.85, receiveShadow), 4 wood border boxes + 4 corner blocks (`#8b6914`, roughness 0.6)
- `SceneDemoPage.tsx` at route `/scene` for dev preview
- Table size: 10×10 units, border width 0.4, border height 0.25

### 2C-2: Tile Mesh System ✅
- `TileMesh.tsx` — `BoxGeometry(0.42, 0.58, 0.16)` with 6-face `MeshStandardMaterial` array
- Face texture on +Z side, back texture on -Z side, ivory side textures on ±X and +Y, matte bottom on -Y
- `tileTextures.ts` — canvas-rendered 256px textures for all 42 tile faces (cached by key), back texture (deep blue with border/diamond ornament), side texture (ivory with depth gradient)
- Character rendering: correct colors per suit (red wan, green tiao, blue tong), black winds, colored dragons/seasons/flowers
- Two orientation modes:
  - **Standing** (`flat=false`): tile stands upright, `rotationY` controls which direction face points. Opponents' tiles face outward (main player sees back).
  - **Flat** (`flat=true`): tile lies on table, face texture pointing up (+Y). Used for main player's hand.
- `rotationY` orientation: bottom=0, top=π, left=-π/2, right=π/2
- Tile states: hover (Y lift 0.08 + white emissive glow), selected (Y lift 0.2 + gold emissive glow), smooth animation via `useFrame`
- Raycaster interaction: `onClick`, `onPointerOver`/`onPointerOut` with cursor change
- Layout: 18 tiles max per side (4 kongs + 1 pair), left-aligned per player's perspective, corner margin 0.8–1.5 units
- castShadow + receiveShadow enabled

### 2C-3: Hand Layout & Interaction
- Extract tile positioning logic from `SceneDemoPage` into reusable `HandLayout.tsx` component
- Compute positions for 4 sides from game state: player hand (flat, face-up), 3 opponents (standing, facing outward)
- Wire to Zustand `game-store`: read `handOrder`, `selectedTileId`, `opponentHands`
- Tile selection via store's `selectTile()` action
- Drag-to-reorder in 3D (R3F drag events or pointer-based reorder)
- Handle variable hand sizes (13 initial, 14 after draw, up to 18 with kongs)

### 2C-4: Table Layout & HTML Overlays
- Use `@react-three/drei`'s `<Html>` component to overlay player labels (name, wind 东/南/西/北, dealer badge 庄) positioned at each seat in 3D space
- Bonus tile display: small flat 3D tiles near each player's seat area
- Center area: turn indicator text, discard pool placeholder
- Active turn indicator: highlight on current player's label

### 2C-5: Game Board Integration
- Replace the CSS 3D `GameBoard.tsx` with a new component that mounts `GameCanvas` + Three.js scene
- Wire `RoomPage.tsx` to render the 3D game board when `gameView` is active
- Pass `gameView`, `userId`, `roomPlayers` props through to the 3D scene
- Preserve the header bar (room code, round wind, wall count, leave button) as HTML above the canvas

### 2C-6: Broadcast & Sync
- Wire existing socket broadcasts (`game:tileSelected`, `game:tileDeselected`, `game:handReordered`, `game:tileDragging`) to 3D tile state
- Opponent selected-tile highlight: standing tile gets subtle Y lift at the broadcast position
- Opponent drag state: visual feedback on reorder
- Ensure all existing broadcast functionality works identically in 3D

---

## Three.js Visual Targets

These match or approach Mahjong Soul's quality:

**Tiles**
- `BoxGeometry` with `MeshStandardMaterial` per face
- Top face: painted tile texture from sprite atlas (SVG → texture)
- Sides: ivory/cream with subtle edge wear
- Back: deep blue/green with traditional pattern texture
- `roughness: 0.3`, `metalness: 0.05` for a slight ceramic sheen
- Real shadow casting onto table surface

**Table**
- Large `PlaneGeometry` with PBR felt material (green, slightly rough)
- Wood border as extruded geometry or box meshes around the edge
- Environment map for subtle reflections on tile surfaces

**Camera**
- Fixed first-person view, positioned below and looking up at ~25-30 degree angle
- Smooth camera transitions on game events (zoom in on win, subtle pan on turn change)
- Optional: slight camera sway/breathing for life-like feel

**Lighting**
- `DirectionalLight` from above-left (simulating overhead lamp), casting shadows
- `AmbientLight` for fill (prevents pure-black shadows)
- Optional `PointLight` at center (warm glow on discard pool area)
- `HemisphereLight` for sky/ground ambient

**Animations** (Phase 3 — Polish)
- Draw tile: tile rises from wall, flips to reveal face, slides into hand with easing
- Discard: tile lifts, follows bezier arc to discard pool, lands with slight bounce + shadow
- Chow/pung/kong: claimed tile slides from pool, hand tiles slide out, snap together with flash
- Win: camera zooms to winner's hand, tiles fan out, particle burst, golden light bloom

**Particle Effects** (Phase 3+ — Polish)
- Win: gold/red confetti burst (Three.js `Points` or instanced meshes)
- Kong: golden sparkle ring
- Skill cards: magical particle trails, shatter effects

---

## Architecture: What's Rendering vs What's Not

### Rendered in Three.js (inside `<Canvas>`)

| Element | Implementation |
|---------|---------------|
| Table surface | `PlaneGeometry` + PBR felt material |
| Table border | Box meshes with wood material |
| Tiles (hand, discards, melds, wall) | `BoxGeometry` + per-face materials |
| Tile shadows | Three.js shadow maps |
| Lighting | Directional + ambient + point lights |
| Particle effects | Three.js `Points` / instanced meshes |

### HTML overlays on canvas (via R3F `<Html>`)

| Component | Role |
|-----------|------|
| `PlayerLabel` | Name, wind, dealer badge — positioned over each seat |
| Action prompt buttons (chow/pung/kong/win) | HTML overlay — easier to style and make accessible |
| Scoreboard | HTML panel overlaid on canvas corner |
| Turn timer | HTML countdown ring |
| Chat / voice controls | HTML UI elements |
| Win announcement banner | HTML overlay with CSS animations |

### Unchanged layers (no rendering dependency)

| Layer | Files | Why |
|-------|-------|-----|
| Game logic | `packages/common/src/` (tiles, rules, scoring, game-state) | Pure TypeScript |
| Server | `packages/server/src/` (socket handlers, game manager, room, auth, db) | Server never touches rendering |
| State management | `packages/client/src/stores/game-store.ts` | Zustand store holds game data, not rendering state |
| Socket layer | `packages/client/src/services/socket.ts` | Transport layer, rendering-agnostic |
| Auth/lobby UI | Login, register, room pages | Standard React + Tailwind |
| Types & events | `packages/common/src/types/` | Shared data contracts |

---

## Client File Structure (3D Rendering)

```
packages/client/src/
├── components/
│   ├── three/                  # Three.js rendering layer
│   │   ├── GameCanvas.tsx      # R3F <Canvas> mount, scene composition
│   │   ├── TileMesh.tsx        # 3D tile component (BoxGeometry + materials)
│   │   ├── TableMesh.tsx       # Table surface + border meshes
│   │   ├── HandLayout.tsx      # Positions tiles for player/opponent hands
│   │   ├── SceneLighting.tsx   # Lights + shadow configuration
│   │   └── animations.ts       # Tween/clock-based animation helpers
│   ├── overlays/               # HTML overlays on canvas
│   │   ├── PlayerLabel.tsx
│   │   ├── ActionPrompt.tsx
│   │   ├── ScoreBoard.tsx
│   │   └── TurnTimer.tsx
│   └── ...                     # Lobby, auth, etc. (unchanged)
├── stores/                     # Zustand stores (unchanged)
├── services/                   # Socket, API (unchanged)
└── pages/
    ├── RoomPage.tsx            # Mounts GameCanvas when game active
    └── ...
```
