import React, { useRef } from 'react';
import type { PlacedBranching, PlacedHose, Point } from '../../types/firemap';

interface BranchingLayerProps {
  branchings: PlacedBranching[];
  hoses: PlacedHose[];
  selectedId: string | null;
  zoom: number;
  mode: string;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  /** Клик по выходному коннектору переходника — начать рисование рукава от него. */
  onOutputClick: (branchingInstanceId: string, x: number, y: number) => void;
}

/** Размер иконки переходника. */
const BRANCHING_SIZE = 28;

/** Смещения 3 выходных коннекторов (снизу, веером). */
const OUTPUT_OFFSETS: Point[] = [
  { x: -14, y: 18 },
  { x: 0, y: 22 },
  { x: 14, y: 18 },
];

/** Смещение входного коннектора (сверху). */
const INPUT_OFFSET: Point = { x: 0, y: -18 };

export function getBranchingConnectors(b: PlacedBranching) {
  return {
    input: { x: b.x + INPUT_OFFSET.x, y: b.y + INPUT_OFFSET.y },
    outputs: OUTPUT_OFFSETS.map(o => ({ x: b.x + o.x, y: b.y + o.y })),
  };
}

export default function BranchingLayer({
  branchings,
  hoses,
  selectedId,
  zoom,
  mode,
  onSelect,
  onMove,
  onOutputClick,
}: BranchingLayerProps) {
  return (
    <g>
      {branchings.map(b => (
        <g key={b.instance_id}>
          <BranchingItem
            b={b}
            hoses={hoses}
            isSelected={b.instance_id === selectedId}
            zoom={zoom}
            mode={mode}
            onSelect={() => onSelect(b.instance_id)}
            onMove={(x, y) => onMove(b.instance_id, x, y)}
            onOutputClick={onOutputClick}
          />
        </g>
      ))}
    </g>
  );
}

function BranchingItem({
  b,
  hoses,
  isSelected,
  zoom,
  mode,
  onSelect,
  onMove,
  onOutputClick,
}: {
  b: PlacedBranching;
  hoses: PlacedHose[];
  isSelected: boolean;
  zoom: number;
  mode: string;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onOutputClick: BranchingLayerProps['onOutputClick'];
}) {
  const dragState = useRef<{
    startPlanX: number;
    startPlanY: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  const half = BRANCHING_SIZE / 2;
  const cr = 5 / zoom; // connector radius
  const connectors = getBranchingConnectors(b);

  // Определяем, какие выходы уже заняты рукавами
  const usedOutputIndices = new Set<number>();
  hoses.forEach(h => {
    if (h.waypoints.length > 0) {
      const start = h.waypoints[0];
      connectors.outputs.forEach((o, i) => {
        if (Math.hypot(start.x - o.x, start.y - o.y) < 5) {
          usedOutputIndices.add(i);
        }
      });
    }
  });

  // Определяем, занят ли вход
  const inputUsed = hoses.some(h => {
    if (!h.endpoint) return false;
    if (h.endpoint.type === 'branching' && h.endpoint.branching_instance_id === b.instance_id) return true;
    return false;
  });

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (mode !== 'select') return;
    e.stopPropagation();
    onSelect();
    dragState.current = {
      startPlanX: b.x,
      startPlanY: b.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!dragState.current) return;
    const dx = (e.clientX - dragState.current.startClientX) / zoom;
    const dy = (e.clientY - dragState.current.startClientY) / zoom;
    onMove(dragState.current.startPlanX + dx, dragState.current.startPlanY + dy);
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  return (
    <g
      transform={`translate(${b.x} ${b.y})`}
      style={{ cursor: mode === 'select' ? 'move' : 'default' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={e => e.stopPropagation()}
    >
      {/* Подсветка */}
      {isSelected && (
        <rect
          x={-half - 4}
          y={-half - 4}
          width={BRANCHING_SIZE + 8}
          height={BRANCHING_SIZE + 8}
          rx={4}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth={2 / zoom}
          strokeDasharray={`${5 / zoom} ${3 / zoom}`}
        />
      )}

      {/* Корпус переходника */}
      <rect
        x={-half}
        y={-half}
        width={BRANCHING_SIZE}
        height={BRANCHING_SIZE}
        rx={6}
        fill="#fef3c7"
        stroke="#d97706"
        strokeWidth={1.5 / zoom}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10 / zoom}
        fill="#92400e"
        fontWeight="700"
      >
        Р
      </text>

      {/* Входной коннектор (сверху) */}
      <circle
        cx={INPUT_OFFSET.x}
        cy={INPUT_OFFSET.y}
        r={cr}
        fill={inputUsed ? '#94a3b8' : '#f59e0b'}
        stroke="#92400e"
        strokeWidth={1 / zoom}
      />
      <text
        x={INPUT_OFFSET.x}
        y={INPUT_OFFSET.y - cr - 3 / zoom}
        textAnchor="middle"
        fontSize={7 / zoom}
        fill="#92400e"
      >
        вход
      </text>

      {/* Выходные коннекторы (снизу, веером) */}
      {OUTPUT_OFFSETS.map((o, i) => {
        const isFree = !usedOutputIndices.has(i);
        return (
          <circle
            key={i}
            cx={o.x}
            cy={o.y}
            r={cr}
            fill={isFree ? '#22c55e' : '#94a3b8'}
            stroke={isFree ? '#16a34a' : '#64748b'}
            strokeWidth={1 / zoom}
            style={{ cursor: isFree ? 'pointer' : 'not-allowed' }}
            onClick={e => {
              e.stopPropagation();
              if (isFree) {
                onOutputClick(b.instance_id, b.x + o.x, b.y + o.y);
              }
            }}
          />
        );
      })}
    </g>
  );
}
