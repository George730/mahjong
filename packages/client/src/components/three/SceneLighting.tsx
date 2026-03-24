// Scene lighting: directional (with shadows) + ambient fill + warm center point light

import { useRef } from "react";
import { useHelper } from "@react-three/drei";
import * as THREE from "three";

interface SceneLightingProps {
  debug?: boolean;
}

export default function SceneLighting({ debug }: SceneLightingProps) {
  const dirLightRef = useRef<THREE.DirectionalLight>(null!);

  // Show helper in debug mode
  if (debug) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useHelper(dirLightRef, THREE.DirectionalLightHelper, 1, "yellow");
  }

  return (
    <>
      {/* Main overhead directional light — casts shadows */}
      <directionalLight
        ref={dirLightRef}
        position={[0, 10, 0]}
        intensity={1.8}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-bias={-0.001}
      />

      {/* Ambient fill — prevents pure-black shadows */}
      <ambientLight intensity={0.4} color="#e8e0d0" />

      {/* Warm point light at center — glow on discard area */}
      <pointLight
        position={[0, 3, 0]}
        intensity={0.6}
        color="#ffdfb0"
        distance={12}
        decay={2}
      />

      {/* Hemisphere light — sky/ground ambient */}
      <hemisphereLight
        args={["#b0d0ff", "#2a1a0a", 0.3]}
      />
    </>
  );
}
