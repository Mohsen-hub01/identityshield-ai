import { Canvas, useFrame } from "@react-three/fiber";
import {
  AdaptiveDpr,
  Float,
  Line,
  MeshDistortMaterial,
  OrbitControls,
  PointMaterial,
  Points,
} from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Fingerprint } from "lucide-react";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { usePreferences } from "@/services/preferences/PreferencesContext";
import { cn, isWebGLAvailable } from "@/lib/utils";

interface CoreNode {
  position: [number, number, number];
  color: string;
  size: number;
}

function CoreScene({ staticMode }: { staticMode: boolean }) {
  const rings = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    const count = 520;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 2.1 + Math.random() * 2.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.72;
      positions[index * 3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, []);

  const nodes = useMemo<CoreNode[]>(() => {
    const palette = ["#FF4D6D", "#FFB547", "#00D9FF", "#00E5C3", "#3878FF"];
    return Array.from({ length: 16 }, (_, index) => {
      const angle = (index / 16) * Math.PI * 2 + 0.35;
      const radius = 2.45 + (index % 3) * 0.28;
      const y = Math.sin(index * 1.7) * 1.15;
      return {
        position: [
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
        ],
        color: palette[index % palette.length],
        size: 0.035 + (index % 4) * 0.012,
      };
    });
  }, []);

  useFrame((state, delta) => {
    if (staticMode) return;
    if (rings.current) {
      rings.current.rotation.y += delta * 0.11;
      rings.current.rotation.z += delta * 0.025;
    }
    if (inner.current) {
      inner.current.rotation.y -= delta * 0.16;
      inner.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.22) * 0.12;
    }
  });

  return (
    <>
      <color attach="background" args={["#05070c"]} />
      <fog attach="fog" args={["#05070c", 7, 13]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 3, 5]} intensity={38} color="#00D9FF" distance={18} />
      <pointLight position={[-4, -3, 3]} intensity={22} color="#3878FF" distance={16} />
      <pointLight position={[0, 4, -5]} intensity={16} color="#00E5C3" distance={18} />

      <Float
        speed={staticMode ? 0 : 1.1}
        rotationIntensity={staticMode ? 0 : 0.18}
        floatIntensity={staticMode ? 0 : 0.3}
      >
        <group ref={inner}>
          <mesh>
            <icosahedronGeometry args={[1.12, 5]} />
            <MeshDistortMaterial
              color="#043545"
              emissive="#00D9FF"
              emissiveIntensity={0.42}
              roughness={0.22}
              metalness={0.72}
              distort={staticMode ? 0 : 0.16}
              speed={staticMode ? 0 : 1.1}
              transparent
              opacity={0.94}
            />
          </mesh>
          <mesh scale={1.02}>
            <icosahedronGeometry args={[1.12, 2]} />
            <meshBasicMaterial
              color="#00E5C3"
              wireframe
              transparent
              opacity={0.12}
            />
          </mesh>
          <mesh scale={1.28}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial
              color="#00D9FF"
              transparent
              opacity={0.025}
              side={THREE.BackSide}
            />
          </mesh>
        </group>
      </Float>

      <group ref={rings}>
        <mesh rotation={[Math.PI / 2.4, 0.2, 0]}>
          <torusGeometry args={[2.05, 0.007, 8, 180]} />
          <meshBasicMaterial color="#00D9FF" transparent opacity={0.52} />
        </mesh>
        <mesh rotation={[Math.PI / 1.9, -0.5, 0.4]}>
          <torusGeometry args={[2.55, 0.005, 8, 180]} />
          <meshBasicMaterial color="#3878FF" transparent opacity={0.4} />
        </mesh>
        <mesh rotation={[0.2, 0.4, Math.PI / 2]}>
          <torusGeometry args={[1.65, 0.004, 8, 160]} />
          <meshBasicMaterial color="#00E5C3" transparent opacity={0.3} />
        </mesh>
      </group>

      <group>
        {nodes.map((node, index) => (
          <group key={index}>
            <Line
              points={[[0, 0, 0], node.position]}
              color={node.color}
              lineWidth={0.55}
              transparent
              opacity={0.22}
            />
            <mesh position={node.position}>
              <sphereGeometry args={[node.size, 10, 10]} />
              <meshBasicMaterial color={node.color} />
            </mesh>
          </group>
        ))}
      </group>

      <Points positions={particles} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#5EEBFF"
          size={0.024}
          sizeAttenuation
          depthWrite={false}
          opacity={0.65}
        />
      </Points>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={!staticMode}
        autoRotateSpeed={0.45}
      />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.62}
          luminanceThreshold={0.32}
          luminanceSmoothing={0.85}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.2} darkness={0.72} />
      </EffectComposer>
      <AdaptiveDpr pixelated />
    </>
  );
}

export function CoreFallback({
  className,
  message = "Static identity core",
}: {
  className?: string;
  message?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-950/40",
        className,
      )}
      role="img"
      aria-label="Static identity protection core visualization"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,217,255,0.12),transparent_62%)]" />
      <div className="relative size-44">
        <div className="absolute inset-0 rounded-full border border-shield-cyan/15" />
        <div className="absolute inset-5 rounded-full border border-shield-cyan/20" />
        <div className="absolute inset-10 rounded-full border border-shield-blue/25" />
        <div className="absolute inset-0 rounded-full border border-transparent border-t-shield-cyan/50 spin-slow" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-shield-cyan/25 bg-shield-cyan/[0.06] shadow-[0_0_60px_-10px_rgba(0,217,255,0.55)]">
            <Fingerprint className="size-8 text-shield-cyan" strokeWidth={1.25} />
          </div>
        </div>
      </div>
      <span className="absolute bottom-3 text-[9px] uppercase tracking-[0.18em] text-mist/60">
        {message}
      </span>
    </div>
  );
}

export function IdentityCore({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { reducedMotion, visuals3d } = usePreferences();
  const supported = isWebGLAvailable();

  if (!supported || !visuals3d) {
    return (
      <CoreFallback
        className={className}
        message={!supported ? "WebGL unavailable Â· static view" : "3D visuals disabled"}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-950/40",
        compact ? "h-[300px]" : "h-[360px]",
        className,
      )}
      role="img"
      aria-label="Interactive 3D identity protection core. Drag to rotate."
    >
      <ErrorBoundary
        fallback={<CoreFallback className="h-full border-0" message="Static fallback active" />}
      >
        <Canvas
          dpr={[1, 1.6]}
          frameloop={reducedMotion ? "demand" : "always"}
          camera={{ position: [0, 0, 6.4], fov: 42 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          aria-hidden
        >
          <CoreScene staticMode={reducedMotion} />
        </Canvas>
      </ErrorBoundary>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-950/85 to-transparent" />
      <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/[0.08] bg-ink-950/55 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-mist backdrop-blur">
        <span className="size-1.5 rounded-full bg-shield-cyan pulse-dot" />
        Identity core Â· live canvas
      </div>
      <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-mist/60">
        <span className="size-1.5 rounded-full bg-shield-teal" />
        16 linked nodes
      </div>
    </div>
  );
}
