// Root Three.js canvas — mounts the R3F scene with camera, lights, and table.
// This component replaces the old CSS 3D GameBoard for rendering.

import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import SceneLighting from "./SceneLighting.tsx";
import TableMesh from "./TableMesh.tsx";

interface GameCanvasProps {
  className?: string;
  children?: React.ReactNode;
}

export default function GameCanvas({ className, children }: GameCanvasProps) {
  return (
    <div className={className} style={{ width: "100%", aspectRatio: "4 / 3" }}>
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ borderRadius: 12 }}
      >
        {/* First-person camera: seated at the near (+Z) side, looking at table center */}
        <PerspectiveCamera
          makeDefault
          position={[0, 8, 9]}
          fov={45}
          near={0.1}
          far={100}
          rotation={[-0.72, 0, 0]}
        />

        {/* Background color */}
        <color attach="background" args={["#0d1a12"]} />

        <SceneLighting />
        <TableMesh />
        {children}
      </Canvas>
    </div>
  );
}
