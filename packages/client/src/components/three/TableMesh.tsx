// 3D mahjong table: green felt surface + wood border frame
// The table lies in the XZ plane at Y=0.

import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";

// Table dimensions (world units)
const TABLE_SIZE = 10;
const BORDER_WIDTH = 0.4;
const BORDER_HEIGHT = 0.25;

// Materials (created once, shared across instances)
const feltColor = new THREE.Color("#1a5c38");
const woodColor = new THREE.Color("#8b6914");

/** A thin line between two 3D points, rendered just above the felt surface. */
function DiagonalLine({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const ref = useRef<THREE.Line>(null!);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ]);
    return geo;
  }, [from, to]);
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.12, transparent: true }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return <primitive ref={ref} object={new THREE.Line(geometry, material)} />;
}

export default function TableMesh() {
  const { feltMaterial, woodMaterial } = useMemo(() => {
    const felt = new THREE.MeshStandardMaterial({
      color: feltColor,
      roughness: 0.85,
      metalness: 0.0,
    });

    const wood = new THREE.MeshStandardMaterial({
      color: woodColor,
      roughness: 0.6,
      metalness: 0.05,
    });

    return { feltMaterial: felt, woodMaterial: wood };
  }, []);

  const half = TABLE_SIZE / 2;
  const bw = BORDER_WIDTH;
  const bh = BORDER_HEIGHT;
  // Border outer edge
  const outer = half + bw;

  return (
    <group>
      {/* Felt surface */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0, 0]}
        material={feltMaterial}
        receiveShadow
      >
        <planeGeometry args={[TABLE_SIZE, TABLE_SIZE]} />
      </mesh>

      {/* Wood border — 4 sides */}
      {/* Top border (far side, -Z) */}
      <mesh
        position={[0, bh / 2, -(half + bw / 2)]}
        material={woodMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[TABLE_SIZE + bw * 2, bh, bw]} />
      </mesh>

      {/* Bottom border (near side, +Z) */}
      <mesh
        position={[0, bh / 2, half + bw / 2]}
        material={woodMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[TABLE_SIZE + bw * 2, bh, bw]} />
      </mesh>

      {/* Left border (-X) */}
      <mesh
        position={[-(half + bw / 2), bh / 2, 0]}
        material={woodMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[bw, bh, TABLE_SIZE]} />
      </mesh>

      {/* Right border (+X) */}
      <mesh
        position={[half + bw / 2, bh / 2, 0]}
        material={woodMaterial}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[bw, bh, TABLE_SIZE]} />
      </mesh>

      {/* Diagonal lines connecting opposite corners */}
      <DiagonalLine from={[-half, 0.005, -half]} to={[half, 0.005, half]} />
      <DiagonalLine from={[half, 0.005, -half]} to={[-half, 0.005, half]} />

      {/* Corner blocks (fill the 4 corners) */}
      {[
        [-outer + bw / 2, -outer + bw / 2],
        [outer - bw / 2, -outer + bw / 2],
        [-outer + bw / 2, outer - bw / 2],
        [outer - bw / 2, outer - bw / 2],
      ].map(([x, z], i) => (
        <mesh
          key={i}
          position={[x, bh / 2, z]}
          material={woodMaterial}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[bw, bh, bw]} />
        </mesh>
      ))}
    </group>
  );
}

export { TABLE_SIZE, BORDER_WIDTH, BORDER_HEIGHT };
