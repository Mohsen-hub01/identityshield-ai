import { Canvas } from "@react-three/fiber";
import {
  AdaptiveDpr,
  Html,
  Line,
  OrbitControls,
} from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";
import { Network } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { usePreferences } from "@/services/preferences/PreferencesContext";
import { cn, isWebGLAvailable } from "@/lib/utils";
import type { ThreatLink, ThreatNode } from "@/types/api";

const LEVEL_COLORS: Record<string, string> = {
  HIGH: "#FF4D6D",
  MEDIUM: "#FFB547",
  LOW: "#00D9FF",
};

function buildPositions(nodes: ThreatNode[]) {
  const map = new Map<string, THREE.Vector3>();
  const identities = nodes.filter((node) => node.type === "identity");
  const countries = nodes.filter((node) => node.type === "country");

  identities.forEach((node, index) => {
    const angle = (index / Math.max(identities.length, 1)) * Math.PI * 2;
    const radius = 2.8 + (index % 3) * 0.55;
    map.set(
      node.id,
      new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(index * 1.4) * 1.35,
        Math.sin(angle) * radius,
      ),
    );
  });

  countries.forEach((node, index) => {
    const angle = (index / Math.max(countries.length, 1)) * Math.PI * 2 + 0.18;
    const radius = 6.4 + (index % 2) * 0.7;
    map.set(
      node.id,
      new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(index * 1.1) * 2.1,
        Math.sin(angle) * radius,
      ),
    );
  });

  return map;
}

function NodeMesh({
  node,
  position,
  selected,
  onSelect,
}: {
  node: ThreatNode;
  position: THREE.Vector3;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isIdentity = node.type === "identity";
  const color = isIdentity
    ? LEVEL_COLORS[node.risk_level]
    : node.risk_level === "HIGH"
      ? "#FF7A95"
      : "#3878FF";
  const radius = isIdentity
    ? 0.1 + Math.min(node.event_count / 900, 0.09) + (selected ? 0.06 : 0)
    : 0.24 + (selected ? 0.08 : 0);

  return (
    <group position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        scale={hovered ? 1.45 : selected ? 1.32 : 1}
      >
        {isIdentity ? (
          <sphereGeometry args={[radius, 16, 16]} />
        ) : (
          <octahedronGeometry args={[radius, 0]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected || hovered ? 1.8 : 0.75}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      {selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius + 0.16, 0.008, 8, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      ) : null}
      {node.type === "country" || selected ? (
        <Html
          position={[0, radius + 0.26, 0]}
          center
          distanceFactor={14}
          style={{ pointerEvents: "none" }}
        >
          <span
            className={cn(
              "whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[9px] backdrop-blur",
              node.type === "country"
                ? "border-white/10 bg-ink-950/70 text-mist"
                : "border-shield-cyan/20 bg-ink-950/80 text-shield-cyan",
            )}
          >
            {node.label}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

function GraphScene({
  nodes,
  links,
  selectedId,
  onSelect,
  staticMode,
}: {
  nodes: ThreatNode[];
  links: ThreatLink[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  staticMode: boolean;
}) {
  const positions = useMemo(() => buildPositions(nodes), [nodes]);

  const lineData = useMemo(() => {
    const positionsArray: number[] = [];
    const colorsArray: number[] = [];
    const selectedLines: Array<{
      points: [THREE.Vector3, THREE.Vector3];
      color: string;
    }> = [];

    for (const link of links) {
      const source = positions.get(link.source);
      const target = positions.get(link.target);
      if (!source || !target) continue;

      positionsArray.push(source.x, source.y, source.z, target.x, target.y, target.z);
      const color = new THREE.Color(
        link.high_risk > 0 ? "#FF4D6D" : link.suspicious > 0 ? "#FFB547" : "#00D9FF",
      );
      colorsArray.push(color.r, color.g, color.b, color.r, color.g, color.b);

      if (selectedId && (link.source === selectedId || link.target === selectedId)) {
        selectedLines.push({
          points: [source, target],
          color: link.high_risk > 0 ? "#FF4D6D" : "#00D9FF",
        });
      }
    }

    return {
      positions: new Float32Array(positionsArray),
      colors: new Float32Array(colorsArray),
      selectedLines,
    };
  }, [links, positions, selectedId]);

  return (
    <>
      <color attach="background" args={["#05070c"]} />
      <fog attach="fog" args={["#05070c", 9, 20]} />
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 6, 8]} intensity={50} color="#00D9FF" distance={30} />
      <pointLight position={[-7, -4, -6]} intensity={32} color="#3878FF" distance={26} />

      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[lineData.positions, 3]}
          />
          <bufferAttribute attach="attributes-color" args={[lineData.colors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.16} />
      </lineSegments>

      {lineData.selectedLines.map((link, index) => (
        <Line
          key={index}
          points={link.points}
          color={link.color}
          lineWidth={1.25}
          transparent
          opacity={0.75}
        />
      ))}

      {nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        return (
          <NodeMesh
            key={node.id}
            node={node}
            position={position}
            selected={node.id === selectedId}
            onSelect={onSelect}
          />
        );
      })}

      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={17}
        autoRotate={!staticMode}
        autoRotateSpeed={0.35}
        dampingFactor={0.08}
      />
      <AdaptiveDpr pixelated />
    </>
  );
}

export function ThreatGraphFallback({
  nodes,
  links,
  selectedId,
  onSelect,
  className,
}: {
  nodes: ThreatNode[];
  links: ThreatLink[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const layout = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const identities = nodes.filter((node) => node.type === "identity");
    const countries = nodes.filter((node) => node.type === "country");
    identities.forEach((node, index) => {
      const angle = (index / Math.max(identities.length, 1)) * Math.PI * 2;
      map.set(node.id, {
        x: 400 + Math.cos(angle) * 155,
        y: 260 + Math.sin(angle) * 118,
      });
    });
    countries.forEach((node, index) => {
      const angle = (index / Math.max(countries.length, 1)) * Math.PI * 2 + 0.2;
      map.set(node.id, {
        x: 400 + Math.cos(angle) * 320,
        y: 260 + Math.sin(angle) * 205,
      });
    });
    return map;
  }, [nodes]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-950/40",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,120,255,0.1),transparent_65%)]" />
      <svg viewBox="0 0 800 520" className="relative h-full w-full" role="img">
        <title>Identity and country relationship graph</title>
        {links.map((link, index) => {
          const source = layout.get(link.source);
          const target = layout.get(link.target);
          if (!source || !target) return null;
          return (
            <line
              key={index}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={link.high_risk > 0 ? "#FF4D6D" : "#00D9FF"}
              strokeOpacity={selectedId ? 0.12 : 0.16}
              strokeWidth={0.6}
            />
          );
        })}
        {nodes.map((node) => {
          const point = layout.get(node.id);
          if (!point) return null;
          const color =
            node.type === "identity"
              ? LEVEL_COLORS[node.risk_level]
              : node.risk_level === "HIGH"
                ? "#FF7A95"
                : "#3878FF";
          const radius =
            node.type === "identity"
              ? 3 + Math.min(node.event_count / 160, 5)
              : 5.5;
          return (
            <g
              key={node.id}
              onClick={() => onSelect(node.id)}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(node.id);
              }}
            >
              <circle
                cx={point.x}
                cy={point.y}
                r={radius + (node.id === selectedId ? 3 : 0)}
                fill={color}
                fillOpacity={node.id === selectedId ? 1 : 0.8}
                stroke={node.id === selectedId ? "#F5F8FC" : "transparent"}
                strokeWidth={1}
              />
              {node.type === "country" ? (
                <text
                  x={point.x}
                  y={point.y - 11}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize={8}
                  fontFamily="monospace"
                >
                  {node.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/[0.08] bg-ink-950/60 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-mist">
        <Network className="size-3 text-shield-cyan" />
        2D fallback
      </div>
    </div>
  );
}

export function ThreatGraph3D({
  nodes,
  links,
  selectedId,
  onSelect,
  className,
}: {
  nodes: ThreatNode[];
  links: ThreatLink[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const { reducedMotion, visuals3d } = usePreferences();
  const supported = isWebGLAvailable();

  if (!supported || !visuals3d) {
    return (
      <ThreatGraphFallback
        nodes={nodes}
        links={links}
        selectedId={selectedId}
        onSelect={onSelect}
        className={cn("h-[520px]", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative h-[520px] overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-950/40",
        className,
      )}
      role="img"
      aria-label="Interactive 3D graph of synthetic identities and countries. Drag to rotate and click a node for details."
    >
      <ErrorBoundary
        fallback={
          <ThreatGraphFallback
            nodes={nodes}
            links={links}
            selectedId={selectedId}
            onSelect={onSelect}
            className="h-full border-0"
          />
        }
      >
        <Canvas
          dpr={[1, 1.6]}
          frameloop={reducedMotion ? "demand" : "always"}
          camera={{ position: [0, 4.5, 13], fov: 46 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          aria-hidden
        >
          <GraphScene
            nodes={nodes}
            links={links}
            selectedId={selectedId}
            onSelect={onSelect}
            staticMode={reducedMotion}
          />
        </Canvas>
      </ErrorBoundary>
      <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/[0.08] bg-ink-950/55 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-mist backdrop-blur">
        <span className="size-1.5 rounded-full bg-shield-cyan pulse-dot" />
        Drag to rotate · click a node
      </div>
      <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-3 text-[9px] uppercase tracking-[0.14em] text-mist/70">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-danger" /> high
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-warning" /> medium
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-shield-cyan" /> low
        </span>
      </div>
    </div>
  );
}
