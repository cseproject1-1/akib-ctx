import { memo, useState, useRef, useEffect, useMemo, useCallback, CSSProperties } from 'react';
import { getBezierPath, getSmoothStepPath, getStraightPath, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { X, Palette, Type, Zap, ZapOff, ArrowLeftRight, Copy, Sparkles, Columns2 } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';

interface EdgeData {
  lineStyle?: string;
  color?: string;
  thickness?: number;
  animated?: boolean;
  pathType?: string;
  markerEndStyle?: string;
  markerStartStyle?: string;
  bidirectional?: boolean;
  opacity?: number;
  gradientEnabled?: boolean;
  gradientEndColor?: string;
  animationSpeed?: string;
  glowEnabled?: boolean;
  doubleLine?: boolean;
}

const edgeStyleMap: Record<string, string> = {
  solid: '',
  dashed: '10 6',
  dotted: '3 5',
};

const EDGE_COLORS = [
  { value: 'hsl(0, 0%, 40%)', label: 'Gray' },
  { value: 'hsl(0, 85%, 55%)', label: 'Red' },
  { value: 'hsl(30, 95%, 55%)', label: 'Orange' },
  { value: 'hsl(52, 100%, 50%)', label: 'Yellow' },
  { value: 'hsl(140, 70%, 45%)', label: 'Green' },
  { value: 'hsl(210, 90%, 55%)', label: 'Blue' },
  { value: 'hsl(280, 75%, 55%)', label: 'Purple' },
  { value: 'hsl(187, 85%, 53%)', label: 'Cyan' },
];

const THICKNESS_PRESETS = [
  { label: 'Thin', value: 1.5 },
  { label: 'Medium', value: 2.5 },
  { label: 'Thick', value: 4 },
];

const PATH_TYPES = [
  { label: 'Bezier', value: 'bezier' },
  { label: 'Step', value: 'step' },
  { label: 'Straight', value: 'straight' },
];

const MARKER_STYLES = [
  { label: 'Arrow', value: 'arrow' },
  { label: 'Diamond', value: 'diamond' },
  { label: 'Circle', value: 'circle' },
  { label: 'None', value: 'none' },
];

const OPACITY_PRESETS = [
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '100%', value: 100 },
];

const SPEED_PRESETS = [
  { label: 'Slow', value: 'slow', dur: '4s' },
  { label: 'Normal', value: 'normal', dur: '2s' },
  { label: 'Fast', value: 'fast', dur: '1s' },
];

export const CustomEdge = memo(({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  label,
  data,
}: EdgeProps) => {
  const deleteEdge = useCanvasStore((s) => s.deleteEdge);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const pushSnapshot = useCanvasStore((s) => s.pushSnapshot);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelText, setLabelText] = useState((label as string) || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  const d = (data as EdgeData) || {};
  const edgeStyle = d.lineStyle || 'solid';
  const edgeColor = d.color || 'hsl(0, 0%, 40%)';
  const edgeThickness = d.thickness || 2;
  const isAnimated = d.animated ?? false;
  const pathType = d.pathType || 'bezier';
  const markerEndStyle = d.markerEndStyle || 'arrow';
  const markerStartStyle = d.markerStartStyle || 'none';
  const bidirectional = d.bidirectional ?? false;
  const edgeOpacity = d.opacity ?? 100;
  const gradientEnabled = d.gradientEnabled ?? false;
  const gradientEndColor = d.gradientEndColor || 'hsl(280, 75%, 55%)';
  const animationSpeed = d.animationSpeed || 'normal';
  const glowEnabled = d.glowEnabled ?? false;
  const doubleLine = d.doubleLine ?? false;

  useEffect(() => {
    if (!editingLabel) {
      setLabelText((label as string) || '');
    }
  }, [label, editingLabel]);

  useEffect(() => {
    if (editingLabel && inputRef.current) inputRef.current.focus();
  }, [editingLabel]);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // --- Spring physics for bezier control points ---
  const prevPos = useRef({ sx: sourceX, sy: sourceY, tx: targetX, ty: targetY });
  const velocity = useRef({ sx: 0, sy: 0, tx: 0, ty: 0 });
  const springOffset = useRef({ cx1: 0, cy1: 0, cx2: 0, cy2: 0 });
  // Store latest positions in a ref to avoid stale closure in RAF callback
  const posRef = useRef({ sourceX, sourceY, targetX, targetY });
  posRef.current = { sourceX, sourceY, targetX, targetY };
  const rafId = useRef<number>(0);
  const [physicsPath, setPhysicsPath] = useState<string>('');
  const [physicsLabelPos, setPhysicsLabelPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Compute the base (non-physics) path for non-bezier types and as fallback
  const [basePath, baseLabelX, baseLabelY] = useMemo(() => {
    // Safety check: if positions are NaN, return empty or safe default path
    if (isNaN(sourceX) || isNaN(sourceY) || isNaN(targetX) || isNaN(targetY)) {
      return ['', 0, 0];
    }

    if (pathType === 'step') {
      return getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 20 });
    }
    if (pathType === 'straight') {
      return getStraightPath({ sourceX, sourceY, targetX, targetY });
    }
    return getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.4 });
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, pathType]);

  // Spring simulation for bezier edges
  const SPRING = 0.08;
  const DAMPING = 0.85;
  const INFLUENCE = 0.9;

  const minFrames = useRef(0);

  const simulateSpring = useCallback(() => {
    const prev = prevPos.current;
    const vel = velocity.current;
    const off = springOffset.current;
    // Read from ref to avoid stale closure when RAF fires after props change
    const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = posRef.current;

    // Safety check for NaN
    if (isNaN(sx) || isNaN(sy) || isNaN(tx) || isNaN(ty)) return;

    vel.sx = sx - prev.sx;
    vel.sy = sy - prev.sy;
    vel.tx = tx - prev.tx;
    vel.ty = ty - prev.ty;

    prev.sx = sx;
    prev.sy = sy;
    prev.tx = tx;
    prev.ty = ty;

    // Mass factor: longer edges feel heavier (pre-calculate mass to save cycles)
    const edgeLen = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
    const mass = Math.max(0.4, Math.min(1.0, 300 / (edgeLen + 150)));

    // Apply velocity impulse to spring offsets (perpendicular-ish sway)
    off.cx1 += (vel.sy * INFLUENCE - vel.sx * INFLUENCE * 0.3) * mass;
    off.cy1 += (-vel.sx * INFLUENCE + vel.sy * INFLUENCE * 0.3) * mass;
    off.cx2 += (vel.ty * INFLUENCE - vel.tx * INFLUENCE * 0.3) * mass;
    off.cy2 += (-vel.tx * INFLUENCE + vel.ty * INFLUENCE * 0.3) * mass;

    // Spring force: pull back to 0
    off.cx1 += -off.cx1 * SPRING;
    off.cy1 += -off.cy1 * SPRING;
    off.cx2 += -off.cx2 * SPRING;
    off.cy2 += -off.cy2 * SPRING;

    // Damping
    off.cx1 *= DAMPING;
    off.cy1 *= DAMPING;
    off.cx2 *= DAMPING;
    off.cy2 *= DAMPING;

    // Build custom bezier path with offset control points
    const dx = tx - sx;
    const curvature = 0.4;
    const cx1 = sx + dx * curvature + off.cx1;
    const cy1 = sy + off.cy1;
    const cx2 = tx - dx * curvature + off.cx2;
    const cy2 = ty + off.cy2;

    const path = `M${sx},${sy} C${cx1},${cy1} ${cx2},${cy2} ${tx},${ty}`;
    setPhysicsPath(path);
    setPhysicsLabelPos({
      x: (sx + tx) / 2 + (off.cx1 + off.cx2) * 0.15,
      y: (sy + ty) / 2 + (off.cy1 + off.cy2) * 0.15,
    });

    // Keep animating if offsets are still significant or minimum frames not reached
    minFrames.current = Math.max(0, minFrames.current - 1);
    
    // Check if the change since last frame is practically zero to sleep early
    // Check if we can sleep the simulation
    const mag = Math.abs(off.cx1) + Math.abs(off.cy1) + Math.abs(off.cx2) + Math.abs(off.cy2);
    const velMag = Math.abs(vel.sx) + Math.abs(vel.sy) + Math.abs(vel.tx) + Math.abs(vel.ty);
    
    if (mag < 0.1 && velMag < 0.05 && minFrames.current === 0) {
      off.cx1 = 0; off.cy1 = 0; off.cx2 = 0; off.cy2 = 0;
      setPhysicsPath(''); // Reset to base path
      return; 
    }

    if (isMounted.current) {
      rafId.current = requestAnimationFrame(simulateSpring);
    }
  }, []); // Empty deps — reads from posRef to avoid stale closure

  // Kick off spring simulation when positions change (bezier only)
  useEffect(() => {
    if (pathType !== 'bezier') return;
    minFrames.current = 8; // Ensure at least 8 frames of animation
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(simulateSpring);
    return () => {
      cancelAnimationFrame(rafId.current);
      // Reset offsets on unmount to prevent artifacts if component is reused
      springOffset.current = { cx1: 0, cy1: 0, cx2: 0, cy2: 0 };
    };
  }, [sourceX, sourceY, targetX, targetY, pathType, simulateSpring]);

  // Initialize physics path on mount / pathType change
  useEffect(() => {
    if (pathType === 'bezier') {
      setPhysicsPath(basePath);
      setPhysicsLabelPos({ x: baseLabelX, y: baseLabelY });
    }
  }, [pathType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use physics path for bezier, base path otherwise
  const edgePath = pathType === 'bezier' && physicsPath ? physicsPath : basePath;
  const labelX = pathType === 'bezier' ? physicsLabelPos.x : baseLabelX;
  const labelY = pathType === 'bezier' ? physicsLabelPos.y : baseLabelY;

  const [pathLength, setPathLength] = useState(0);
  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, [edgePath]);

  const handleDelete = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    deleteEdge(id); 
  };

  const updateEdgeDataWithSnapshot = (newData: Record<string, unknown>, label = 'Update Edge') => {
    pushSnapshot(label);
    updateEdgeData(id, newData);
  };

  const handleStyleChange = (style: string) => { updateEdgeDataWithSnapshot({ lineStyle: style }, 'Change Edge Style'); setShowStylePicker(false); };
  const handleColorChange = (c: string) => { updateEdgeDataWithSnapshot({ color: c }, 'Change Edge Color'); setShowColorPicker(false); };
  const handleThicknessChange = (t: number) => { updateEdgeDataWithSnapshot({ thickness: t }, 'Change Edge Weight'); };
  const handlePathTypeChange = (t: string) => { updateEdgeDataWithSnapshot({ pathType: t }, 'Change Edge Path'); };
  const handleToggleAnimated = () => { updateEdgeDataWithSnapshot({ animated: !isAnimated }, 'Toggle Edge Flow'); };
  const handleMarkerEndChange = (m: string) => { updateEdgeDataWithSnapshot({ markerEndStyle: m }, 'Change Edge Marker'); };
  const handleMarkerStartChange = (m: string) => { updateEdgeDataWithSnapshot({ markerStartStyle: m }, 'Change Edge Marker'); };
  const handleToggleBidirectional = () => {
    const next = !bidirectional;
    updateEdgeDataWithSnapshot({ bidirectional: next, markerStartStyle: next ? markerEndStyle : 'none' }, 'Toggle Edge Direction');
  };
  const handleOpacityChange = (o: number) => { updateEdgeDataWithSnapshot({ opacity: o }, 'Change Edge Opacity'); };
  const handleToggleGradient = () => { updateEdgeDataWithSnapshot({ gradientEnabled: !gradientEnabled }, 'Toggle Edge Gradient'); };
  const handleGradientEndColorChange = (c: string) => { updateEdgeDataWithSnapshot({ gradientEndColor: c }, 'Change Edge Gradient'); };
  const handleSpeedChange = (s: string) => { updateEdgeDataWithSnapshot({ animationSpeed: s }, 'Change Edge Speed'); };
  const handleToggleGlow = () => { updateEdgeDataWithSnapshot({ glowEnabled: !glowEnabled }, 'Toggle Edge Glow'); };
  const handleToggleDoubleLine = () => { updateEdgeDataWithSnapshot({ doubleLine: !doubleLine }, 'Toggle Edge Double Line'); };
  const handleDuplicate = (e: React.MouseEvent) => { e.stopPropagation(); useCanvasStore.getState().duplicateEdge(id); };
  const handleReverse = (e: React.MouseEvent) => { e.stopPropagation(); useCanvasStore.getState().reverseEdge(id); };

  const handleLabelSave = () => {
    const trimmed = labelText.trim();
    if (trimmed === (label || '')) {
      setEditingLabel(false);
      return;
    }
    pushSnapshot('Update Edge Label');
    updateEdgeData(id, { label: trimmed });
    setEditingLabel(false);
  };

  const strokeColor = selected ? 'hsl(52, 100%, 50%)' : edgeColor;
  const globalOpacity = edgeOpacity / 100;
  const speedDur = SPEED_PRESETS.find(s => s.value === animationSpeed)?.dur || '2s';

  // Marker IDs unique per edge
  const markerEndId = `marker-end-${id}`;
  const markerStartId = `marker-start-${id}`;
  const gradientId = `edge-gradient-${id}`;

  const effectiveMarkerStart = bidirectional ? markerEndStyle : markerStartStyle;

  const renderMarkerDef = (markerId: string, style: string, color: string) => {
    if (style === 'none') return null;
    if (style === 'arrow') {
      return (
        <marker id={markerId} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
        </marker>
      );
    }
    if (style === 'diamond') {
      return (
        <marker id={markerId} markerWidth="14" markerHeight="14" refX="7" refY="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M7,1 L13,7 L7,13 L1,7 Z" fill={color} stroke={color} strokeWidth="1" />
        </marker>
      );
    }
    if (style === 'circle') {
      return (
        <marker id={markerId} markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="3.5" fill={color} stroke={color} strokeWidth="1" />
        </marker>
      );
    }
    return null;
  };

  const [isJustCreated, setIsJustCreated] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIsJustCreated(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <defs>
        {renderMarkerDef(markerEndId, markerEndStyle, strokeColor)}
        {renderMarkerDef(markerStartId, effectiveMarkerStart, strokeColor)}
        {gradientEnabled && (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={strokeColor} />
            <stop offset="100%" stopColor={selected ? gradientEndColor : gradientEndColor} />
          </linearGradient>
        )}
      </defs>

      <g opacity={globalOpacity}>
        {/* New connection pulse */}
        {isJustCreated && (
          <path d={edgePath} fill="none" stroke={strokeColor} className="edge-new-pulse" />
        )}

        {/* Glow layer or pulse glow */}
        {glowEnabled && (
          <path d={edgePath} fill="none" stroke={edgeColor} strokeWidth={edgeThickness + 10} strokeOpacity={0.25} 
            className="edge-pulse-glow" style={{ filter: 'blur(8px)', '--stroke-width': `${edgeThickness}px` } as CSSProperties & Record<string, string>} />
        )}

        {/* Selection glow */}
        {selected && (
          <path d={edgePath} fill="none" stroke={strokeColor} strokeWidth={edgeThickness + 8} strokeOpacity={0.08} style={{ filter: 'blur(6px)', transition: 'all 0.25s ease' }} />
        )}

        {/* Hover glow */}
        <path d={edgePath} fill="none" stroke={edgeColor} strokeWidth={edgeThickness + 4} strokeOpacity={0} className="edge-hover-glow" style={{ transition: 'stroke-opacity 0.2s ease' }} />

        {/* Double line - white gap underneath */}
        {doubleLine && (
          <path d={edgePath} fill="none" stroke="hsl(var(--background))" strokeWidth={edgeThickness + 4} strokeLinecap="round" strokeLinejoin="round"
            style={{ strokeDasharray: edgeStyleMap[edgeStyle] || undefined }} />
        )}

        {/* Main edge path */}
        {/* Tension based thinning/glow */}
        <path
          ref={pathRef}
          id={id}
          className={`react-flow__edge-path ${isAnimated ? 'edge-dash-animated' : ''}`}
          d={edgePath}
          markerEnd={markerEndStyle !== 'none' ? `url(#${markerEndId})` : undefined}
          markerStart={effectiveMarkerStart !== 'none' ? `url(#${markerStartId})` : undefined}
          style={{
            stroke: gradientEnabled ? `url(#${gradientId})` : strokeColor,
            strokeWidth: (() => {
              // Round 5: Tension Physics
              const dx = targetX - sourceX;
              const dy = targetY - sourceY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const baseWidth = selected ? edgeThickness + 0.5 : edgeThickness;
              // Thinning effect: edges get thinner as they stretch
              const tensionFactor = Math.max(0.4, Math.min(1.0, 600 / (dist + 300)));
              return baseWidth * tensionFactor;
            })(),
            strokeDasharray: isAnimated ? undefined : (edgeStyleMap[edgeStyle] || undefined),
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            transition: 'stroke 0.2s ease, stroke-width 0.1s ease', // Faster width transition
          }}
        />

        {/* Tension Glow (Dynamic based on distance) */}
        {(() => {
          const dist = Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2));
          if (dist > 800) {
            return (
              <path d={edgePath} fill="none" stroke={strokeColor} strokeWidth={1} strokeOpacity={Math.min(0.5, (dist - 800) / 1000)} style={{ filter: 'blur(2px)' }} />
            );
          }
          return null;
        })()}

        {/* Direction Indicator on Hover */}
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={edgeThickness + 2}
          strokeOpacity={0}
          className="transition-opacity hover:opacity-20"
          style={{ strokeDasharray: '4 8' }}
        />

        {/* Double line - second line on top */}
        {doubleLine && (
          <path d={edgePath} fill="none" stroke={gradientEnabled ? `url(#${gradientId})` : strokeColor}
            strokeWidth={Math.max(1, edgeThickness - 2)} strokeLinecap="round" strokeLinejoin="round"
            style={{ strokeDasharray: edgeStyleMap[edgeStyle] || undefined }} />
        )}

        {/* Animated flow particles */}
        {isAnimated && pathLength > 0 && (
          <>
            <circle r={edgeThickness + 1} fill={strokeColor} opacity={0.8}>
              <animateMotion dur={speedDur} repeatCount="indefinite" path={edgePath} />
            </circle>
            <circle r={edgeThickness * 0.6} fill={strokeColor} opacity={0.4}>
              <animateMotion dur={speedDur} repeatCount="indefinite" path={edgePath} begin={`${parseFloat(speedDur) * 0.35}s`} />
            </circle>
            <circle r={edgeThickness * 0.4} fill={strokeColor} opacity={0.25}>
              <animateMotion dur={speedDur} repeatCount="indefinite" path={edgePath} begin={`${parseFloat(speedDur) * 0.7}s`} />
            </circle>
          </>
        )}

        {/* Invisible wider path for easier clicking */}
        <path d={edgePath} fill="none" stroke="transparent" strokeWidth={24} style={{ cursor: 'pointer' }} />
      </g>

      {/* Selected toolbar */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="absolute flex items-center gap-1 animate-scale-in"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all', zIndex: 600 }}
          >
            {/* Delete */}
            <button className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-all hover:scale-110 active:scale-95" onClick={handleDelete} title="Delete edge">
              <X className="h-3 w-3" />
            </button>

            {/* Animate toggle */}
            <button className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all hover:scale-110 ${isAnimated ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary'}`}
              onClick={(e) => { e.stopPropagation(); handleToggleAnimated(); }} title={isAnimated ? 'Stop animation' : 'Animate flow'}>
              {isAnimated ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
            </button>

            {/* Bidirectional toggle */}
            <button className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all hover:scale-110 ${bidirectional ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary'}`}
              onClick={(e) => { e.stopPropagation(); handleToggleBidirectional(); }} title="Bidirectional">
              <ArrowLeftRight className="h-3 w-3" />
            </button>

            {/* Glow toggle */}
            <button className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all hover:scale-110 ${glowEnabled ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary'}`}
              onClick={(e) => { e.stopPropagation(); handleToggleGlow(); }} title="Toggle glow">
              <Sparkles className="h-3 w-3" />
            </button>

            {/* Double line toggle */}
            <button className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all hover:scale-110 ${doubleLine ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary'}`}
              onClick={(e) => { e.stopPropagation(); handleToggleDoubleLine(); }} title="Double line">
              <Columns2 className="h-3 w-3" />
            </button>

            {/* Style picker */}
            <div className="relative">
              <button className="flex h-6 items-center gap-0.5 rounded-full bg-card border-2 border-border px-2 text-[10px] font-bold uppercase text-muted-foreground transition-colors hover:text-foreground hover:border-primary"
                onClick={(e) => { e.stopPropagation(); setShowStylePicker(!showStylePicker); setShowColorPicker(false); }}>
                Style
              </button>
              {showStylePicker && (
                <div className="absolute left-0 top-7 z-50 flex flex-col gap-0.5 rounded-lg border border-border bg-card p-1.5 shadow-[var(--clay-shadow-sm)] animate-scale-in min-w-[130px] max-h-[320px] overflow-y-auto">
                  {/* Line style */}
                  <span className="px-2 text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Line</span>
                  {['solid', 'dashed', 'dotted'].map((s) => (
                    <button key={s} onClick={(e) => { e.stopPropagation(); handleStyleChange(s); }}
                      className={`flex items-center gap-2 rounded px-2.5 py-1 text-xs font-bold capitalize transition-colors ${edgeStyle === s ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}>
                      <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" strokeDasharray={edgeStyleMap[s] || undefined} strokeLinecap="round" /></svg>
                      {s}
                    </button>
                  ))}

                  <div className="my-1 h-px bg-border" />
                  <span className="px-2 text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Weight</span>
                  {THICKNESS_PRESETS.map((t) => (
                    <button key={t.value} onClick={(e) => { e.stopPropagation(); handleThicknessChange(t.value); }}
                      className={`flex items-center gap-2 rounded px-2.5 py-1 text-xs font-bold transition-colors ${edgeThickness === t.value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}>
                      <svg width="24" height={Math.ceil(t.value) + 4}><line x1="0" y1={Math.ceil(t.value / 2) + 2} x2="24" y2={Math.ceil(t.value / 2) + 2} stroke="currentColor" strokeWidth={t.value} strokeLinecap="round" /></svg>
                      {t.label}
                    </button>
                  ))}

                  <div className="my-1 h-px bg-border" />
                  <span className="px-2 text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Path</span>
                  {PATH_TYPES.map((p) => (
                    <button key={p.value} onClick={(e) => { e.stopPropagation(); handlePathTypeChange(p.value); }}
                      className={`flex items-center gap-2 rounded px-2.5 py-1 text-xs font-bold transition-colors ${pathType === p.value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}>
                      {p.label}
                    </button>
                  ))}

                  <div className="my-1 h-px bg-border" />
                  <span className="px-2 text-[9px] font-bold uppercase text-muted-foreground tracking-wider">End Marker</span>
                  {MARKER_STYLES.map((m) => (
                    <button key={m.value} onClick={(e) => { e.stopPropagation(); handleMarkerEndChange(m.value); }}
                      className={`flex items-center gap-2 rounded px-2.5 py-1 text-xs font-bold transition-colors ${markerEndStyle === m.value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}>
                      {m.label}
                    </button>
                  ))}

                  {!bidirectional && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <span className="px-2 text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Start Marker</span>
                      {MARKER_STYLES.map((m) => (
                        <button key={m.value} onClick={(e) => { e.stopPropagation(); handleMarkerStartChange(m.value); }}
                          className={`flex items-center gap-2 rounded px-2.5 py-1 text-xs font-bold transition-colors ${markerStartStyle === m.value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}>
                          {m.label}
                        </button>
                      ))}
                    </>
                  )}

                  <div className="my-1 h-px bg-border" />
                  <span className="px-2 text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Opacity</span>
                  {OPACITY_PRESETS.map((o) => (
                    <button key={o.value} onClick={(e) => { e.stopPropagation(); handleOpacityChange(o.value); }}
                      className={`flex items-center gap-2 rounded px-2.5 py-1 text-xs font-bold transition-colors ${edgeOpacity === o.value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}>
                      {o.label}
                    </button>
                  ))}

                  {isAnimated && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <span className="px-2 text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Speed</span>
                      {SPEED_PRESETS.map((s) => (
                        <button key={s.value} onClick={(e) => { e.stopPropagation(); handleSpeedChange(s.value); }}
                          className={`flex items-center gap-2 rounded px-2.5 py-1 text-xs font-bold transition-colors ${animationSpeed === s.value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}>
                          {s.label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Color picker */}
            <div className="relative">
              <button className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-card transition-all hover:scale-110 hover:border-primary"
                onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowStylePicker(false); }} title="Edge color">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: edgeColor }} />
              </button>
              {showColorPicker && (
                <div className="absolute left-1/2 -translate-x-1/2 top-7 z-50 flex flex-col gap-1.5 rounded-lg border border-border bg-card p-1.5 shadow-[var(--clay-shadow-sm)] animate-scale-in">
                  <span className="px-1 text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Color</span>
                  <div className="grid grid-cols-4 gap-1">
                    {EDGE_COLORS.map((c) => (
                      <button key={c.value} onClick={(e) => { e.stopPropagation(); handleColorChange(c.value); }}
                        className={`h-5 w-5 rounded-full border-2 transition-all hover:scale-125 ${edgeColor === c.value ? 'scale-125 border-foreground ring-1 ring-foreground' : 'border-transparent'}`}
                        style={{ backgroundColor: c.value }} title={c.label} />
                    ))}
                  </div>
                  {/* Gradient toggle */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <button onClick={(e) => { e.stopPropagation(); handleToggleGradient(); }}
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded transition-colors ${gradientEnabled ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                      Gradient
                    </button>
                  </div>
                  {gradientEnabled && (
                    <>
                      <span className="px-1 text-[9px] font-bold uppercase text-muted-foreground tracking-wider">End Color</span>
                      <div className="grid grid-cols-4 gap-1">
                        {EDGE_COLORS.map((c) => (
                          <button key={c.value} onClick={(e) => { e.stopPropagation(); handleGradientEndColorChange(c.value); }}
                            className={`h-5 w-5 rounded-full border-2 transition-all hover:scale-125 ${gradientEndColor === c.value ? 'scale-125 border-foreground ring-1 ring-foreground' : 'border-transparent'}`}
                            style={{ backgroundColor: c.value }} title={c.label} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Label edit */}
            <button className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all hover:scale-110 ${editingLabel ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground'}`}
              onClick={(e) => { e.stopPropagation(); setEditingLabel(!editingLabel); }} title="Edit label">
              <Type className="h-3 w-3" />
            </button>

            {/* Duplicate */}
            <button className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground transition-all hover:scale-110 hover:border-primary hover:text-foreground"
              onClick={handleDuplicate} title="Duplicate edge">
              <Copy className="h-3 w-3" />
            </button>

            {/* Reverse */}
            <button className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground transition-all hover:scale-110 hover:border-primary hover:text-foreground"
              onClick={handleReverse} title="Reverse direction">
              <ArrowLeftRight className="h-3 w-3 rotate-180" />
            </button>
          </div>

          {/* Inline label editor */}
          {editingLabel && (
            <div className="absolute animate-fade-in" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 28}px)`, pointerEvents: 'all' }}>
              <input ref={inputRef} type="text" value={labelText} onChange={(e) => setLabelText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLabelSave(); if (e.key === 'Escape') setEditingLabel(false); }}
                onBlur={handleLabelSave} placeholder="Edge label…"
                className="w-36 rounded-lg border border-primary bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-[var(--clay-shadow-sm)] outline-none placeholder:text-muted-foreground" />
            </div>
          )}
        </EdgeLabelRenderer>
      )}

      {/* Label display */}
      {label && !editingLabel && (
        <EdgeLabelRenderer>
          <div className="absolute animate-fade-in" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 20}px)`, pointerEvents: 'none' }}>
            <div className="rounded-md border-2 border-border bg-card px-2.5 py-1 text-[11px] font-bold text-foreground shadow-sm">{label}</div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

CustomEdge.displayName = 'CustomEdge';
