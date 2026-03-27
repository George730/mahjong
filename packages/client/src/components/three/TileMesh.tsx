// 3D mahjong tile — either standing upright facing its owner, or lying flat face-up.
//
// Standing (flat=false):
//   - Width along X, height along Y, depth/thickness along Z
//   - Face texture on +Z, back texture on -Z
//   - rotationY orients which direction the face points
//
// Flat (flat=true):
//   - Tile lies on the table, face texture pointing up (+Y)
//   - Rotated -π/2 around X so +Z face becomes +Y face
//   - Width along X, thickness along Y (low profile), height along Z
//   - This is how the main player sees their own hand (like Mahjong Soul)
//
// Orientation guide for standing tiles (rotationY):
//   - Bottom player (you): rotation-y = 0 (face toward +Z = toward camera)
//   - Top player (opponent): rotation-y = π (face toward -Z = away from camera, you see back)
//   - Left player: rotation-y = -π/2 (face toward -X = outward, you see back)
//   - Right player: rotation-y = π/2 (face toward +X = outward, you see back)

import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TileFace } from "@mahjong/common";
import { getTileFaceTexture, getTileBackTexture, getTileSideTexture } from "./tileTextures.ts";

// Tile dimensions in world units — sized so 18 tiles fit along one table edge (~9 units usable)
export const TILE_WIDTH = 0.42;   // X — width
export const TILE_HEIGHT = 0.58;  // Y — standing height (or Z when flat)
export const TILE_DEPTH = 0.16;   // Z — thickness (or Y when flat)

// Animation constants
const HOVER_LIFT = 0.08;
const SELECT_LIFT = 0.2;
const DRAG_LIFT = 0.15;
const EMISSIVE_HOVER = 0.15;
const EMISSIVE_SELECT = 0.35;
const EMISSIVE_HIGHLIGHT = 0.4;
const LERP_SPEED = 12;

interface TileMeshProps {
  face?: TileFace;
  position?: [number, number, number];
  /** Y-axis rotation to orient the tile face toward a player (standing tiles). */
  rotationY?: number;
  /** If true, tile lies flat on the table with face pointing up. */
  flat?: boolean;
  selected?: boolean;
  /** Tile is being dragged — lifts higher and uses gold glow. */
  dragging?: boolean;
  /** Cyan glow to indicate tile is eligible for a meld claim. */
  highlighted?: boolean;
  onClick?: () => void;
  onPointerDown?: () => void;
  /** Disable hover/select interactivity (e.g. for opponent tiles). */
  interactive?: boolean;
}

export default function TileMesh({
  face,
  position = [0, 0, 0],
  rotationY = 0,
  flat = false,
  selected = false,
  dragging = false,
  highlighted = false,
  onClick,
  onPointerDown,
  interactive = true,
}: TileMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const initialized = useRef(false);

  // BoxGeometry face order: [+x, -x, +y, -y, +z, -z]
  // +z = front face (character), -z = back face (blue pattern)
  // +y = top edge, -y = bottom edge
  // +x, -x = left/right side edges
  //
  // When flat: the -π/2 X rotation maps +Z→+Y, so the front face (characters) points up.
  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({
      map: getTileSideTexture(),
      roughness: 0.4,
      metalness: 0.02,
    });

    const topEdge = new THREE.MeshStandardMaterial({
      map: getTileSideTexture(),
      roughness: 0.35,
      metalness: 0.03,
    });

    const bottom = new THREE.MeshStandardMaterial({
      color: "#d6d0c0",
      roughness: 0.6,
      metalness: 0.0,
    });

    const frontMap = face ? getTileFaceTexture(face) : getTileBackTexture();
    const front = new THREE.MeshStandardMaterial({
      map: frontMap,
      roughness: 0.3,
      metalness: 0.05,
    });

    const back = new THREE.MeshStandardMaterial({
      map: getTileBackTexture(),
      roughness: 0.3,
      metalness: 0.05,
    });

    // [+x, -x, +y, -y, +z, -z]
    return [side, side, topEdge, bottom, front, back];
  }, [face]);

  // Base Y: standing tiles rest on bottom edge, flat tiles rest on back face
  const baseY = flat
    ? position[1] + TILE_DEPTH / 2     // flat: half-thickness off the table
    : position[1] + TILE_HEIGHT / 2;   // standing: half-height off the table

  const lift = dragging ? DRAG_LIFT : selected ? SELECT_LIFT : hovered && interactive ? HOVER_LIFT : 0;
  const targetX = position[0];
  const targetY = baseY + lift;
  const targetZ = position[2];

  // Rotation: flat tiles rotate -π/2 around X to lay down, then rotationY for orientation
  const rotX = flat ? -Math.PI / 2 : 0;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    // First frame: snap to position (avoids lerp from origin)
    if (!initialized.current) {
      mesh.position.set(targetX, targetY, targetZ);
      initialized.current = true;
      return;
    }

    // Smooth position interpolation on all axes
    const speed = Math.min(1, delta * LERP_SPEED);
    mesh.position.x += (targetX - mesh.position.x) * speed;
    mesh.position.y += (targetY - mesh.position.y) * speed;
    mesh.position.z += (targetZ - mesh.position.z) * speed;

    // Emissive glow on front face (material index 4 = +z = character face)
    const targetEmissive = highlighted
      ? EMISSIVE_HIGHLIGHT
      : dragging
        ? EMISSIVE_SELECT
        : selected
          ? EMISSIVE_SELECT
          : hovered && interactive
            ? EMISSIVE_HOVER
            : 0;

    const emissiveColor = highlighted
      ? "#00e5ff"
      : dragging || selected
        ? "#c9a84c"
        : "#ffffff";

    const frontMat = (mesh.material as THREE.MeshStandardMaterial[])[4];
    if (frontMat) {
      const current = frontMat.emissiveIntensity;
      frontMat.emissiveIntensity += (targetEmissive - current) * Math.min(1, delta * 10);
      if (targetEmissive > 0) {
        frontMat.emissive.set(emissiveColor);
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[rotX, rotationY, 0]}
      material={materials}
      castShadow
      receiveShadow
      onClick={interactive && onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onPointerOver={interactive ? (e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; } : undefined}
      onPointerOut={interactive ? () => { setHovered(false); document.body.style.cursor = "auto"; } : undefined}
      onPointerDown={interactive && onPointerDown ? (e) => { e.stopPropagation(); onPointerDown(); } : undefined}
    >
      <boxGeometry args={[TILE_WIDTH, TILE_HEIGHT, TILE_DEPTH]} />
    </mesh>
  );
}
