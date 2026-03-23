# Version Plan — Chinese Standard Mahjong Online

This document defines the two major versions of the project and maps existing phases to each version. The key difference is the **rendering technology**: V1 ships with CSS 3D, V2 migrates to Three.js for a Mahjong Soul-class visual experience.

---

## Version Overview

| | V1 — CSS 3D | V2 — Three.js |
|---|---|---|
| **Rendering** | DOM elements + CSS `transform-style: preserve-3d` | WebGL via Three.js (or React-Three-Fiber) |
| **Tile visuals** | CSS slabs with Chinese text characters | 3D box meshes with painted texture maps |
| **Lighting** | Simulated via gradients, `box-shadow`, `filter: brightness()` | Real-time directional + ambient lights, specular highlights |
| **Shadows** | CSS `box-shadow` (static, approximate) | Shadow maps cast by tiles onto the table |
| **Table** | Flat `<div>` with radial gradient felt texture | 3D plane with PBR felt/wood materials |
| **Perspective** | Per-tile `perspective(200px)` | Single 3D camera with true vanishing point across entire scene |
| **Animations** | CSS `@keyframes` + `transition` | Tween.js / Three.js clock-driven animations |
| **Particles** | CSS pseudo-elements or lightweight `<canvas>` overlay | Three.js particle systems (confetti, sparkle, smoke) |
| **Performance ceiling** | Good for 144 tiles; limited by DOM reflow | Handles thousands of objects; GPU-accelerated |
| **Browser support** | All modern browsers, no GPU requirements | Requires WebGL (99%+ of modern browsers) |
| **Development speed** | Fast — leverages existing Tailwind/React patterns | Slower — new rendering paradigm, texture pipeline |
| **Goal** | Fully playable game with all rules, decent visuals | Mahjong Soul-tier 3D experience |

---

## V1 — CSS 3D (Current)

Ship a **complete, fully playable** Chinese Standard Mahjong game with CSS 3D rendering. All game logic, multiplayer, and core features land here. Visual polish is "good enough" — clean, readable, responsive, but not cinematic.

### V1 Phases

| Phase | Name | Scope | Status |
|-------|------|-------|--------|
| 1 | Foundation | Auth (register + guest), room creation/joining, lobby UI, shareable links, session displacement | Done |
| 2A | Tile System | Tile types/enums, 144-tile set generation, Fisher-Yates shuffle | Done |
| 2B | Game State & Deal | State machine (WAITING → DEALING → PLAYING → ROUND_END), wall, dealing 13/14, flower/season replacement | Done |
| 2C | Table Layout & Live Hand | First-person CSS 3D table view, face-down opponent tiles, broadcast select/reorder | Done |
| 2D | Draw & Discard Loop | Turn cycle (draw → discard → next), discard pool in center, wall counter, click-to-discard | |
| 2E | Claims | Chow/pung/kong logic, claim priority resolution, action prompt UI, claim window timer | |
| 2F | Win Detection | Valid hand check (4 melds + pair, seven pairs, thirteen orphans), self-drawn & discard win, 8-fan gate | |
| 2G | Scoring Engine | All 81 fan patterns, exclusion principle, point computation | |
| 2H | Round & Game Flow | Round-end settlement, score display, wind rotation, next-round dealing, game-end condition | |
| 2I | Timeout & Reconnection | Auto-discard timer, player reconnection with state recovery | |
| 3 | Polish & Social | Voice chat (WebRTC), CSS animations for draw/discard/claim/win, sound effects, responsive layout, chat | |
| 4 | Persistence & Stats | PostgreSQL game records, user profile/history, leaderboard | |
| 5 | Robot Players | Rule-based AI opponents, configurable difficulty, fill empty seats | |

### V1 CSS 3D Visual Targets

These are achievable with CSS 3D and represent the V1 visual quality bar:

**Tiles**
- 3-face CSS slab (top, front edge, right edge) — already implemented
- Tile face images (SVG) instead of raw text characters
- `box-shadow` for drop shadows on the table surface
- Hover: lift 6px + shadow expansion + `scale(1.05)`
- Selected: lift 12px + gold bottom glow
- Just drawn: golden shimmer via `@keyframes` + positioned with gap from existing hand

**Table**
- Single `perspective` on the table container (not per-tile) for unified vanishing point
- Radial gradient felt texture + subtle noise pattern
- Wood-tone border with inner shadow for depth
- Foreshortening on opponent tiles via `perspective` + `rotateX`

**Animations (CSS `@keyframes` + `transition`)**
- Draw tile: slide from wall area into hand (400ms ease-out)
- Discard: lift from hand, translate to discard pool position (500ms)
- Chow/pung: tiles slide from discard + hand into meld area (600ms)
- Kong: four tiles converge + golden flash (700ms)
- Win announcement: screen dim + tiles fly to center + fan banner overlay (stepped, ~2s total)
- Turn change: glow sweep on active player area (300ms)
- Score update: counter roll-up animation (800ms)

**Limitations accepted in V1**
- No real-time lighting or specular highlights on tiles
- No true shadow maps (box-shadow only)
- No particle systems (confetti via CSS pseudo-elements, limited)
- No reflections on table surface
- Foreshortening is approximate, not physically accurate
- No post-processing effects (bloom, depth-of-field)

---

## V2 — Three.js Migration

Upgrade the rendering layer to Three.js for a **Mahjong Soul (雀魂)-class** 3D experience. Game logic, server, state management, and socket layer are **unchanged** — only the client rendering is replaced.

### V2 Phases

| Phase | Name | Scope |
|-------|------|-------|
| V2-A | Three.js Scene Setup | Scene, camera, renderer, lights, table mesh, felt/wood materials |
| V2-B | Tile Mesh System | `BoxGeometry` tiles with 6-face materials, tile face texture atlas, face-down back texture |
| V2-C | State Bridge | Connect Zustand game store → Three.js scene (or migrate to React-Three-Fiber for declarative binding) |
| V2-D | Camera & Perspective | First-person camera at bottom position, proper foreshortening, smooth camera transitions |
| V2-E | Lighting & Shadows | Directional light + ambient light, shadow maps on table, specular highlights on tile surfaces |
| V2-F | Core Animations | Tween-based draw/discard/claim/win animations matching Mahjong Soul feel |
| V2-G | Visual Effects | Particle systems (confetti, sparkle), bloom/glow on win, screen-space effects |
| V2-H | Polish | Anti-aliasing, LOD for mobile, performance profiling, fallback to CSS 3D if WebGL unavailable |
| 6 | Cracked Mode (破解版) | Real-time probability engine, hint UI overlay on 3D scene |
| 7 | Skill Mode (技能版) | Skill card design, 3D skill card rendering, effect animations (fog, X-ray, swap flight paths) |
| 8 | Final UI Polish | Tile art assets, avatars, character portraits, dark mode, accessibility audit, mobile optimization |

### V2 Three.js Visual Targets

These match or approach Mahjong Soul's quality:

**Tiles**
- `BoxGeometry(44, 60, 8)` with `MeshStandardMaterial` per face
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

**Animations**
- Draw tile: tile rises from wall, flips to reveal face, slides into hand with easing
- Discard: tile lifts, follows bezier arc to discard pool, lands with slight bounce + shadow
- Chow/pung/kong: claimed tile slides from pool, hand tiles slide out, snap together with flash
- Win: camera zooms to winner's hand, tiles fan out, particle burst, golden light bloom
- Riichi: tile discarded sideways with dramatic slam effect

**Particle Effects**
- Win: gold/red confetti burst (Three.js `Points` or instanced meshes)
- Kong: golden sparkle ring
- Skill cards: magical particle trails, shatter effects

---

## What Changes vs What Stays (V1 → V2)

### Zero changes required

| Layer | Files | Why |
|-------|-------|-----|
| Game logic | `packages/common/src/` (tiles, rules, scoring, game-state) | Pure TypeScript, no rendering dependency |
| Server | `packages/server/src/` (socket handlers, game manager, room, auth, db) | Server never touches rendering |
| State management | `packages/client/src/stores/game-store.ts` | Zustand store holds game data, not rendering state |
| Socket layer | `packages/client/src/services/socket.ts` | Transport layer, rendering-agnostic |
| Auth/lobby UI | Login, register, room pages | Standard React + Tailwind, not part of the game board |
| Types & events | `packages/common/src/types/` | Shared data contracts, rendering-independent |

### Gets replaced

| V1 File | V2 Replacement | Notes |
|---------|----------------|-------|
| `TileRenderer.tsx` (148 LOC) | `three/TileMesh.ts` — 3D tile mesh class | Same props interface (`face`, `size`, `selected`, `faceDown`) |
| `GameBoard.tsx` — table `<div>` + felt gradient | `three/TableMesh.ts` — 3D plane with PBR material | |
| `GameBoard.tsx` — tile layout logic | `three/scene.ts` + `GameCanvas.tsx` — Three.js scene mounted in React | |
| CSS `@keyframes` animations | `three/animations.ts` — tween-based animations | |
| CSS `box-shadow` for tile shadows | Three.js shadow maps | |

### Gets preserved as HTML overlay on canvas

| Component | Role |
|-----------|------|
| `PlayerLabel` | Name, wind, dealer badge — positioned with CSS `position: absolute` over the `<canvas>` |
| Action prompt buttons (chow/pung/kong/win) | HTML overlay, not 3D — easier to style and make accessible |
| Scoreboard | HTML panel overlaid on canvas corner |
| Turn timer | HTML countdown ring |
| Chat / voice controls | HTML UI elements |
| Win announcement banner | HTML overlay with CSS animations (simpler than 3D text) |

---

## New Dependencies (V2)

| Package | Purpose |
|---------|---------|
| `three` | Core 3D rendering engine |
| `@types/three` | TypeScript definitions |
| `@react-three/fiber` | React renderer for Three.js (declarative scene graph, hooks for game store) |
| `@react-three/drei` | Helpers: `OrbitControls`, `Environment`, `Shadow`, `Html` (for overlays) |
| `@tweenjs/tween.js` (optional) | Smooth animation easing (alternative: Three.js `Clock` + manual interpolation) |

---

## Migration Strategy

### Prep during V1 (do now to make V2 easier)

1. **Keep `TileRenderer` props stable** — `face`, `size`, `selected`, `faceDown`, `onClick`. The Three.js tile mesh will accept the same interface.
2. **Keep game state decoupled from rendering** — no CSS-specific logic in Zustand store (already clean).
3. **Introduce tile face SVGs** — needed for Three.js textures anyway. Using them in V1 CSS tiles also improves current appearance.
4. **Abstract animation triggers** — emit animation events from game store (e.g., `{ type: 'draw', tileId, from, to }`) that CSS animations consume in V1 and Three.js tweens consume in V2.

### V2 migration steps

1. Add Three.js + R3F dependencies.
2. Create `GameCanvas.tsx` — mounts a `<Canvas>` from R3F, reads game state from Zustand.
3. Build `TileMesh` — replace CSS slab with `BoxGeometry` + materials.
4. Build `TableMesh` — replace felt `<div>` with 3D plane.
5. Set up camera + lights.
6. Wire animations (draw, discard, claim, win) to tween system.
7. Overlay existing HTML components (`PlayerLabel`, action buttons, scoreboard) on canvas using R3F's `<Html>` component.
8. Remove old `TileRenderer.tsx` and CSS 3D code from `GameBoard.tsx`.
9. Performance test on mobile; add WebGL fallback check → load V1 CSS 3D if no WebGL.

### Estimated scope

- V1 rendering layer: ~500 lines (TileRenderer + GameBoard rendering)
- V2 rendering layer: ~800-1000 lines, but with dramatically richer visuals
- Game logic, server, state: **0 lines changed**
