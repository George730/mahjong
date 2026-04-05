// Overlays on the 3D table — opponent name labels, center wind/wall indicator,
// and bonus tile display. Everything is rendered as 3D geometry (canvas
// textures on flat meshes) so it foreshortens with perspective.
//
// Player labels sit on the wood border, center indicator on the felt.
// Bonus tiles are flat face-up TileMesh instances near the left end of each
// player's hand row, oriented toward their owner, visible to all players.

import { useMemo, useState } from "react";
import * as THREE from "three";
import type { Tile, Meld, PublicPlayerState } from "@mahjong/common";
import { seatsFromPerspective, windForSeat } from "@mahjong/common";
import { useGameStore } from "../../stores/game-store.ts";
import { useRoomStore } from "../../stores/room-store.ts";
import { WIND_CN } from "@mahjong/common";
import TileMesh, { TILE_WIDTH, TILE_HEIGHT } from "./TileMesh.tsx";
import { TABLE_EDGE, ROW_LEFT, SIDE_NAMES, SIDE_ANGLES, rotateAroundY } from "./layout-constants.ts";

// --- Player label positions: standing upright on the wood border ---
// Border is 0.4 wide at ±5.0 to ±5.4, height 0.25.
// Labels stand vertically, centered on the border, bottom edge at border top.
const LABEL_BASE_Y = 0.25; // border top
const BORDER_MID = 5.2;    // center of wood border strip

interface LabelConfig {
  position: (labelH: number) => [number, number, number];
  rotation: [number, number, number];
}

// Labels for opponents only (no bottom/viewer label).
// Canonical: bottom label on +Z border facing -Z (toward center).
const LABEL_CONFIGS: Record<string, LabelConfig> = Object.fromEntries(
  (["top", "left", "right"] as const).map((name) => {
    const angle = SIDE_ANGLES[name];
    return [name, {
      position: (h: number): [number, number, number] =>
        rotateAroundY([0, LABEL_BASE_Y + h / 2, BORDER_MID], angle),
      rotation: [0, Math.PI + angle, 0] as [number, number, number],
    }];
  }),
);

// Bonus tiles: face-up, to the left of (before) each player's hand row,
// shifted inward (toward center) by one tile depth so they don't overlap.
const BONUS_GAP = TILE_WIDTH + 0.02;
const BONUS_INWARD = 0.65; // shift toward center from hand row
const BONUS_SCALE = 0.8;

interface BonusConfig {
  /** Position for the i-th bonus tile (in world coords, not scaled). */
  position: (i: number) => [number, number, number];
  /** World-Y rotation applied via a wrapper group so tile face stays up
   *  while the content spins to face the owning player. */
  orientY: number;
}

// All sides derived from canonical "bottom" layout rotated around Y.
// Canonical: bonus tiles to the LEFT of hand, shifted inward from edge.
const BONUS_CONFIGS: Record<string, BonusConfig> = Object.fromEntries(
  SIDE_NAMES.map((name) => {
    const angle = SIDE_ANGLES[name];
    return [name, {
      position: (i: number): [number, number, number] =>
        rotateAroundY([ROW_LEFT + i * BONUS_GAP * BONUS_SCALE, 0.01, TABLE_EDGE - BONUS_INWARD], angle),
      orientY: angle,
    }];
  }),
);

// Label canvas rendering constants
const LABEL_FONT_SIZE = 16;
const LABEL_PAD_X = 18;
const LABEL_PAD_Y = 8;
const LABEL_SCALE = 0.02; // world units per canvas pixel

/** Render a player name label to a canvas texture. */
function buildLabelTexture(
  username: string,
  isCurrentTurn: boolean,
): { texture: THREE.CanvasTexture; width: number; height: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Measure text width (use a temp canvas since this one has no size yet)
  ctx.font = `400 ${LABEL_FONT_SIZE}px sans-serif`;
  const tw = Math.min(ctx.measureText(username).width, 180);

  const W = Math.ceil(tw + LABEL_PAD_X * 2);
  const H = Math.ceil(LABEL_FONT_SIZE * 1.2 + LABEL_PAD_Y * 2);
  canvas.width = W;
  canvas.height = H;

  // Background pill
  ctx.beginPath();
  ctx.roundRect(1, 1, W - 2, H - 2, 8);
  ctx.fillStyle = isCurrentTurn ? "rgba(202,168,76,0.3)" : "rgba(0,0,0,0.55)";
  ctx.fill();
  ctx.strokeStyle = isCurrentTurn ? "rgba(202,168,76,0.6)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Username text
  ctx.font = `400 ${LABEL_FONT_SIZE}px sans-serif`;
  ctx.fillStyle = "#d1d5db";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(username, W / 2, H / 2, tw);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { texture: tex, width: W, height: H };
}

/** Opponent name label — vertical plane standing on the wood border, facing
 *  inward so it reads correctly and foreshortens with perspective. */
function PlayerLabel({
  username,
  isCurrentTurn,
  side,
}: {
  username: string;
  isCurrentTurn: boolean;
  side: string;
}) {
  const config = LABEL_CONFIGS[side];
  if (!config) return null;

  const { texture, width, height } = useMemo(
    () => buildLabelTexture(username, isCurrentTurn),
    [username, isCurrentTurn],
  );

  const worldW = width * LABEL_SCALE;
  const worldH = height * LABEL_SCALE;
  const pos = config.position(worldH);

  return (
    <mesh position={pos} rotation={config.rotation}>
      <planeGeometry args={[worldW, worldH]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

// --- Center indicator: canvas-rendered texture on a flat 3D circle mesh ---

const INDICATOR_RADIUS = 1.1; // world units (bigger than before)
const TEX_SIZE = 512;          // canvas resolution

// Canvas rotation per wind so each character faces its player.
// Canvas coords: +X = world +X, +Y(down) = world +Z.
//   bottom (viewer at +Z): 0           (normal upright)
//   top    (player at -Z): π           (upside-down from viewer = right-side-up for them)
//   right  (player at +X): -π/2        (top of char points toward canvas right = world +X)
//   left   (player at -X): π/2         (top of char points toward canvas left = world -X)
const WIND_CANVAS_ROTATION: Record<number, number> = {
  0: 0,             // bottom
  1: -Math.PI / 2,  // right
  2: Math.PI,       // top
  3: Math.PI / 2,   // left
};

/** Render the center indicator to a canvas texture. */
function buildIndicatorTexture(
  wallCount: number,
  seatWinds: [string, string, string, string],
  currentTurn: number,
  dealer: number,
): THREE.CanvasTexture {
  const S = TEX_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  const cx = S / 2;
  const cy = S / 2;
  const outerR = S / 2 - 4;
  const innerR = S * 0.22;

  // Outer circle background
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner circle
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(26,92,56,0.75)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Wall count in center
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${S * 0.16}px sans-serif`;
  ctx.fillStyle = "#e0e0e0";
  ctx.fillText(String(wallCount), cx, cy);

  // Wind characters at cardinal positions, each rotated to face its player
  const windR = (outerR + innerR) / 2;
  const windPositions: Array<{ relIdx: number; x: number; y: number }> = [
    { relIdx: 0, x: cx, y: cy + windR },       // bottom of canvas = viewer (+Z)
    { relIdx: 1, x: cx + windR, y: cy },       // right of canvas = right player (+X)
    { relIdx: 2, x: cx, y: cy - windR },       // top of canvas = far player (-Z)
    { relIdx: 3, x: cx - windR, y: cy },       // left of canvas = left player (-X)
  ];

  const fontSize = S * 0.11;
  for (const { relIdx, x, y } of windPositions) {
    const wind = seatWinds[relIdx];
    const isActive = relIdx === currentTurn;
    const isDealer = relIdx === dealer;
    const label = WIND_CN[wind] ?? "";
    const angle = WIND_CANVAS_ROTATION[relIdx] ?? 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (isActive) {
      ctx.shadowColor = "rgba(202,168,76,0.6)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#c9a84c";
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
    }

    ctx.fillText(label, 0, 0);
    ctx.shadowBlur = 0;

    if (isDealer) {
      ctx.font = `bold ${fontSize * 0.5}px sans-serif`;
      ctx.fillStyle = "#c9a84c";
      ctx.fillText("庄", fontSize * 0.55, -fontSize * 0.35);
    }

    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Center table indicator — flat 3D circle mesh with canvas texture, lying on the table. */
function CenterIndicator({
  wallCount,
  seatWinds,
  currentTurn,
  dealer,
}: {
  wallCount: number;
  seatWinds: [string, string, string, string];
  currentTurn: number;
  dealer: number;
}) {
  const texture = useMemo(
    () => buildIndicatorTexture(wallCount, seatWinds, currentTurn, dealer),
    [wallCount, seatWinds, currentTurn, dealer],
  );

  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[INDICATOR_RADIUS, 64]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

/** Bonus tiles face-up near the left end of a player's hand row.
 *
 *  Each tile is wrapped in a group with world-Y rotation (`orientY`) so the
 *  tile face content is right-side-up for the owning player.  TileMesh itself
 *  keeps rotationY=0 so the face always points up (+Y). */
function BonusTiles({ tiles, side }: { tiles: Tile[]; side: string }) {
  const config = BONUS_CONFIGS[side];
  if (!tiles.length) return null;

  return (
    <group scale={[BONUS_SCALE, BONUS_SCALE, BONUS_SCALE]}>
      {tiles.map((tile, i) => {
        const worldPos = config.position(i);
        // Position the wrapper group at the target world pos (divided by
        // BONUS_SCALE to account for the parent scale group), then spin
        // around world Y so the face content faces the owning player.
        const localPos: [number, number, number] = [
          worldPos[0] / BONUS_SCALE,
          worldPos[1] / BONUS_SCALE,
          worldPos[2] / BONUS_SCALE,
        ];
        return (
          <group key={tile.id} position={localPos} rotation={[0, config.orientY, 0]}>
            <TileMesh
              face={tile.face}
              flat
              position={[0, 0, 0]}
              rotationY={0}
              interactive={false}
            />
          </group>
        );
      })}
    </group>
  );
}

// --- Discard area: 4 rows × 5 columns of flat face-up tiles ---
// Positioned between the center indicator and each player's hand row.
// Tiles fill left-to-right, top-to-bottom (top = closer to center, bottom = closer to hand).

const DISCARD_COLS = 6;
const DISCARD_ROWS = 4;
const DISCARD_TILE_SCALE = 0.8;
const DISCARD_GAP_X = (TILE_WIDTH + 0.02) * DISCARD_TILE_SCALE;
const DISCARD_GAP_Z = 0.6 * DISCARD_TILE_SCALE; // row spacing (tile height when flat)

// Discard area center distance from table center (between indicator and hand)
const DISCARD_CENTER_Z = 2.2;

interface DiscardConfig {
  /** Position for tile at (row, col) in world coords. Row 0 is closest to center. */
  position: (row: number, col: number) => [number, number, number];
  /** World-Y rotation so tile faces read right-side-up for the owning player. */
  orientY: number;
}

// Canonical: bottom discard grid centered at Z=DISCARD_CENTER_Z, rotated per side.
const DISCARD_CONFIGS: Record<string, DiscardConfig> = Object.fromEntries(
  SIDE_NAMES.map((name) => {
    const angle = SIDE_ANGLES[name];
    return [name, {
      position: (row: number, col: number): [number, number, number] => {
        const x = (col - (DISCARD_COLS - 1) / 2) * DISCARD_GAP_X;
        const z = DISCARD_CENTER_Z + (row - (DISCARD_ROWS - 1) / 2) * DISCARD_GAP_Z;
        return rotateAroundY([x, 0.01, z], angle);
      },
      orientY: angle,
    }];
  }),
);

/** Discard area — flat face-up tiles in a grid in front of each player. */
function DiscardArea({ tiles, side, highlightTileId }: { tiles: Tile[]; side: string; highlightTileId?: number }) {
  const config = DISCARD_CONFIGS[side];
  if (!config || !tiles.length) return null;

  return (
    <group scale={[DISCARD_TILE_SCALE, DISCARD_TILE_SCALE, DISCARD_TILE_SCALE]}>
      {tiles.map((tile, i) => {
        const row = Math.floor(i / DISCARD_COLS);
        const col = i % DISCARD_COLS;
        if (row >= DISCARD_ROWS) return null; // overflow protection
        const worldPos = config.position(row, col);
        const localPos: [number, number, number] = [
          worldPos[0] / DISCARD_TILE_SCALE,
          worldPos[1] / DISCARD_TILE_SCALE,
          worldPos[2] / DISCARD_TILE_SCALE,
        ];
        return (
          <group key={tile.id} position={localPos} rotation={[0, config.orientY, 0]}>
            <TileMesh
              face={tile.face}
              flat
              position={[0, 0, 0]}
              rotationY={0}
              interactive={false}
              highlighted={tile.id === highlightTileId}
            />
          </group>
        );
      })}
    </group>
  );
}

// --- Meld area: exposed/concealed melds to the right of each player's hand row ---
// Follows the same pattern as BonusTiles: scaled group, oriented per-side.

const MELD_SCALE = 0.8;
const MELD_TILE_GAP = 0.02 * MELD_SCALE; // world-space gap between tile edges in meld
const MELD_INWARD = 0.05; // shift toward center from hand row
const MELD_SPACING = 0.1; // gap between separate melds (world coords)

// ROW_RIGHT = mirror of ROW_LEFT, which is the rightmost tile position
const ROW_RIGHT = -ROW_LEFT; // +3.5

interface MeldConfig {
  /** Position at a given world-space offset along the meld row from the start. */
  positionAtOffset: (offset: number) => [number, number, number];
  orientY: number;
  /** Direction toward the player (perpendicular to meld row), for bottom-aligning rotated tiles. */
  playerDir: [number, number, number];
}

// All sides derived from canonical "bottom" layout rotated around Y.
// Canonical bottom: melds to the RIGHT of hand, row grows right-to-left (offset increases leftward).
const MELD_CONFIGS: Record<string, MeldConfig> = Object.fromEntries(
  SIDE_NAMES.map((name) => {
    const angle = SIDE_ANGLES[name];
    return [name, {
      positionAtOffset: (offset: number): [number, number, number] =>
        rotateAroundY([ROW_RIGHT - offset, 0.01, TABLE_EDGE - MELD_INWARD], angle),
      orientY: angle,
      playerDir: rotateAroundY([0, 0, 1], angle) as [number, number, number],
    }];
  }),
);

/** Single concealed kong — face-down tiles that the owner can hover to reveal.
 *  At round end (revealed=true), the two outer tiles are shown face-up. */
function ConcealedKongMeld({
  meld,
  tileOffsets,
  config,
  isOwner,
  revealed,
}: {
  meld: Meld;
  tileOffsets: number[];
  config: MeldConfig;
  isOwner: boolean;
  revealed?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const showFace = (isOwner && hovered) || revealed;

  return (
    <group
      onPointerOver={isOwner ? () => setHovered(true) : undefined}
      onPointerOut={isOwner ? () => setHovered(false) : undefined}
    >
      {meld.tiles.map((tile, j) => {
        const worldPos = config.positionAtOffset(tileOffsets[j]);
        const localPos: [number, number, number] = [
          worldPos[0] / MELD_SCALE,
          worldPos[1] / MELD_SCALE,
          worldPos[2] / MELD_SCALE,
        ];
        // At round end, reveal outer two tiles (0 and 3), middle two stay face-down
        const isOuter = j === 0 || j === meld.tiles.length - 1;
        const tileShowFace = revealed ? isOuter : showFace;
        return (
          <group key={tile.id} position={localPos} rotation={[0, config.orientY, 0]}>
            <TileMesh
              face={tileShowFace ? tile.face : undefined}
              flat
              position={[0, 0, 0]}
              rotationY={0}
              interactive={false}
            />
          </group>
        );
      })}
    </group>
  );
}

/** Compute world-space tile width: claimed chow tiles are rotated 90° so their
 *  height dimension becomes the row-axis width. */
function meldTileWorldWidth(isClaimed: boolean): number {
  return (isClaimed ? TILE_HEIGHT : TILE_WIDTH) * MELD_SCALE;
}

/** Bottom-alignment shift for rotated claimed tiles (local coords).
 *  The rotated tile is narrower perpendicular to the row (TILE_WIDTH vs TILE_HEIGHT),
 *  so shift it toward the player so near edges align. */
const CLAIMED_ALIGN_SHIFT = (TILE_HEIGHT - TILE_WIDTH) / 2;

/** Meld area — exposed/concealed melds to the right of each player's hand row. */
function MeldArea({ melds, side, isOwner, revealed }: { melds: Meld[]; side: string; isOwner: boolean; revealed?: boolean }) {
  const config = MELD_CONFIGS[side];
  if (!config || !melds.length) return null;

  // Compute per-tile offsets along the meld row (world coords).
  // Each tile's center position accounts for its actual width (rotated tiles are wider).
  // Tiles are reversed so ascending order reads left-to-right (row grows right-to-left).
  let cursor = 0; // world-space distance along row

  return (
    <group scale={[MELD_SCALE, MELD_SCALE, MELD_SCALE]}>
      {melds.map((meld, meldIdx) => {
        if (meldIdx > 0) cursor += MELD_SPACING;

        // Reverse tiles so ascending rank reads left-to-right
        // (meld row grows right-to-left: offset 0 = rightmost position)
        const tiles = [...meld.tiles].reverse();

        // Pre-compute offsets for all tiles in this meld
        const tileOffsets: number[] = [];
        const tileClaimed: boolean[] = [];
        for (let j = 0; j < tiles.length; j++) {
          const isClaimed = meld.exposed && meld.type === "chow" && tiles[j].id === meld.claimedTileId;
          tileClaimed.push(isClaimed);
          const halfW = meldTileWorldWidth(isClaimed) / 2;
          if (j > 0) cursor += MELD_TILE_GAP;
          cursor += halfW;
          tileOffsets.push(cursor);
          cursor += halfW;
        }

        // Concealed kong — face-down with hover-to-flip
        if (!meld.exposed) {
          return (
            <ConcealedKongMeld
              key={meldIdx}
              meld={meld}
              tileOffsets={tileOffsets}
              config={config}
              isOwner={isOwner}
              revealed={revealed}
            />
          );
        }

        // Exposed meld — face-up tiles, chow claimed tile rotated 90° & bottom-aligned
        return tiles.map((tile, j) => {
          const worldPos = config.positionAtOffset(tileOffsets[j]);
          const localPos: [number, number, number] = [
            worldPos[0] / MELD_SCALE,
            worldPos[1] / MELD_SCALE,
            worldPos[2] / MELD_SCALE,
          ];
          const isClaimed = tileClaimed[j];

          // Shift rotated tile toward player so near edges align with normal tiles
          if (isClaimed) {
            localPos[0] += config.playerDir[0] * CLAIMED_ALIGN_SHIFT;
            localPos[2] += config.playerDir[2] * CLAIMED_ALIGN_SHIFT;
          }

          return (
            <group
              key={tile.id}
              position={localPos}
              rotation={[0, config.orientY + (isClaimed ? Math.PI / 2 : 0), 0]}
            >
              <TileMesh
                face={tile.face}
                flat
                position={[0, 0, 0]}
                rotationY={0}
                interactive={false}
              />
            </group>
          );
        });
      })}
    </group>
  );
}

/** Root overlay component — renders labels, center indicator, bonus tiles, discard areas, and melds. */
export default function TableOverlays() {
  const gameView = useGameStore((s) => s.gameView);
  const mySeatIndex = useGameStore((s) => s.mySeatIndex);
  const room = useRoomStore((s) => s.room);
  const highlightedTileIds = useGameStore((s) => s.highlightedTileIds);

  if (!gameView || mySeatIndex === null) return null;

  const seats = seatsFromPerspective(mySeatIndex);
  const [bottomSeat, rightSeat, topSeat, leftSeat] = seats;

  const seatSides: Array<{ seat: number; side: string }> = [
    { seat: bottomSeat, side: "bottom" },
    { seat: rightSeat, side: "right" },
    { seat: topSeat, side: "top" },
    { seat: leftSeat, side: "left" },
  ];

  const getPlayer = (seat: number): PublicPlayerState | undefined =>
    gameView.players.find((p) => p.seatIndex === seat);

  const getUsername = (userId: string): string => {
    const rp = room?.players.find((p) => p.userId === userId);
    return rp?.username ?? "Player";
  };

  // Winds in viewer-relative order for center indicator
  const seatWinds: [string, string, string, string] = [
    windForSeat(bottomSeat),
    windForSeat(rightSeat),
    windForSeat(topSeat),
    windForSeat(leftSeat),
  ];

  // Which viewer-relative index is the current turn?
  const currentTurnRelIdx = seats.indexOf(gameView.currentTurn);
  const dealerRelIdx = seats.indexOf(gameView.dealer);

  // Highlight the last discarded tile when in claiming phase (client-only)
  const highlightDiscardId =
    gameView.turnPhase === "claiming" && gameView.lastDiscard
      ? gameView.lastDiscard.tile.id
      : undefined;

  // Determine which seat's discard area contains the highlighted tile
  const highlightDiscardSeat = gameView.lastDiscard?.fromSeat;

  return (
    <group>
      {/* Center wind/wall indicator */}
      <CenterIndicator
        wallCount={gameView.wallCount}
        seatWinds={seatWinds}
        currentTurn={currentTurnRelIdx}
        dealer={dealerRelIdx}
      />

      {seatSides.map(({ seat, side }) => {
        const player = getPlayer(seat);
        if (!player) return null;

        const username = getUsername(player.userId);

        return (
          <group key={side}>
            {/* Only show name labels for opponents, not the viewer */}
            {seat !== mySeatIndex && (
              <PlayerLabel
                username={username}
                isCurrentTurn={gameView.currentTurn === seat}
                side={side}
              />
            )}
            <BonusTiles tiles={player.bonusTiles} side={side} />
            <DiscardArea
              tiles={player.discards}
              side={side}
              highlightTileId={seat === highlightDiscardSeat && highlightedTileIds.length > 0 ? highlightDiscardId : undefined}
            />
            <MeldArea melds={player.melds} side={side} isOwner={seat === mySeatIndex} revealed={gameView.phase === "roundEnd"} />
          </group>
        );
      })}
    </group>
  );
}
