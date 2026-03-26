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
| 2C | 3D Table & Live Hand | Three.js/R3F scene (`GameCanvas`, `SceneLighting`, `TableMesh`), tile mesh system (`TileMesh`, `tileTextures`), 4-side hand layout with click-to-select & drag-to-reorder, broadcast sync, table overlays (player labels, center indicator, bonus tiles) | Done |
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

## Phase 2C Details ✅

- **Scene**: `GameCanvas.tsx` (R3F Canvas, ACES tone mapping, shadows), `PerspectiveCamera` at (0,8,9) fov 45, `SceneLighting.tsx` (directional+ambient+point+hemisphere lights, 2048px shadow maps), `TableMesh.tsx` (10×10 felt plane + wood border/corners)
- **Tiles**: `TileMesh.tsx` (BoxGeometry 0.42×0.58×0.16, 6-face materials), `tileTextures.ts` (canvas-rendered 256px textures, cached). Standing (upright, rotationY for direction) and flat (face-up) orientations. Hover/select lift + emissive glow, raycaster interaction, castShadow/receiveShadow.
- **Hand layout**: `HandLayout.tsx` with `SIDE_CONFIGS` (bottom/top/left/right). `ViewerHand` (flat, click-to-select, drag-to-reorder with threshold gesture + gap animation). `OpponentHand` (standing, stable tileOrder keys for smooth lerp). Broadcast sync via socket events (select/deselect/drag/reorder, server relay only).
- **Overlays**: `TableOverlays.tsx` — player name labels (canvas texture on vertical PlaneGeometry, standing on wood border), center indicator (canvas texture on CircleGeometry with wind characters oriented per player, wall count, dealer badge), bonus tiles (scaled flat TileMesh with group-wrapper orientation per side).
- **Pages**: `RoomPage.tsx` mounts GameCanvas with HandLayout + TableOverlays when game active. `SceneDemoPage.tsx` at `/scene` with static and store-driven demo modes.

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
│   │   ├── TableOverlays.tsx   # Player labels, bonus tiles, turn indicator (drei <Html>)
│   │   ├── SceneLighting.tsx   # Lights + shadow configuration
│   │   └── animations.ts       # Tween/clock-based animation helpers
│   ├── overlays/               # Future HTML overlays (action prompts, scoreboard, timer)
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
