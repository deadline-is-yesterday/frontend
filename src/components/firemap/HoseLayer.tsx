import React, { useRef } from 'react';
import type { PlacedHose, DrawingHose, Point } from '../../types/firemap';
import { polylineLength } from './useFireMapState';

interface HoseLayerProps {
  hoses: PlacedHose[];
  selectedId: string | null;
  zoom: number;
  scale_m_per_px: number;
  drawingHose: DrawingHose | null;
  cursorPlan: Point;
  onSelect: (id: string) => void;
  onMoveWaypoint?: (hoseId: string, waypointIndex: number, point: Point) => void;
  onMoveWaypointEnd?: (hoseId: string) => void;
  onInsertWaypoint?: (hoseId: string, point: Point) => void;
  onRemoveWaypoint?: (hoseId: string, waypointIndex: number) => void;
  /** Максимальная длина выбранного рукава (нужна для индикатора). */
  selectedHoseMaxLength?: number;
}

/** Catmull-Rom spline через массив точек → SVG path d. */
function catmullRomPath(points: Point[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const segments: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    segments.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`);
  }
  return segments.join(' ');
}

/** Цвет рукава по проценту оставшейся длины. */
function hoseColor(remainPct: number): string {
  if (remainPct > 30) return '#22c55e';
  if (remainPct > 10) return '#eab308';
  return '#ef4444';
}

export default function HoseLayer({
  hoses,
  selectedId,
  zoom,
  scale_m_per_px,
  drawingHose,
  cursorPlan,
  onSelect,
  onMoveWaypoint,
  onMoveWaypointEnd,
  onInsertWaypoint,
  onRemoveWaypoint,
  selectedHoseMaxLength,
}: HoseLayerProps) {
  return (
    <g>
      {hoses.map(hose => {
        const isSelected = hose.id === selectedId;
        return (
          <g key={hose.id}>
            <ExistingHose
              hose={hose}
              isSelected={isSelected}
              zoom={zoom}
              scale_m_per_px={scale_m_per_px}
              maxLengthM={isSelected ? selectedHoseMaxLength : undefined}
              onSelect={() => onSelect(hose.id)}
              onMoveWaypoint={onMoveWaypoint}
              onMoveWaypointEnd={onMoveWaypointEnd}
              onInsertWaypoint={isSelected ? onInsertWaypoint : undefined}
              onRemoveWaypoint={isSelected ? onRemoveWaypoint : undefined}
            />
          </g>
        );
      })}

      {drawingHose && (
        <DrawingHoseOverlay
          dh={drawingHose}
          cursorPlan={cursorPlan}
          zoom={zoom}
          scale_m_per_px={scale_m_per_px}
        />
      )}
    </g>
  );
}

function ExistingHose({
  hose,
  isSelected,
  zoom,
  scale_m_per_px,
  maxLengthM,
  onSelect,
  onMoveWaypoint,
  onMoveWaypointEnd,
  onInsertWaypoint,
  onRemoveWaypoint,
}: {
  hose: PlacedHose;
  isSelected: boolean;
  zoom: number;
  scale_m_per_px: number;
  maxLengthM?: number;
  onSelect: () => void;
  onMoveWaypoint?: (hoseId: string, waypointIndex: number, point: Point) => void;
  onMoveWaypointEnd?: (hoseId: string) => void;
  onInsertWaypoint?: (hoseId: string, point: Point) => void;
  onRemoveWaypoint?: (hoseId: string, waypointIndex: number) => void;
}) {
  const pts = hose.waypoints;
  if (pts.length < 2) return null;

  const currentLenM = polylineLength(pts) * scale_m_per_px;
  const overLimit = isSelected && maxLengthM ? currentLenM > maxLengthM : false;
  const stroke = isSelected ? (overLimit ? '#ef4444' : '#3b82f6') : '#22c55e';

  // Для выбранного рукава — показать цвет по оставшейся длине
  let lengthColor = '#22c55e';
  if (isSelected && maxLengthM) {
    const remainPct = ((maxLengthM - currentLenM) / maxLengthM) * 100;
    lengthColor = currentLenM > maxLengthM ? '#ef4444' : hoseColor(remainPct);
  }

  // Центр пути — для индикатора длины
  const midIdx = Math.floor(pts.length / 2);
  const midPt = pts[midIdx];

  return (
    <g onClick={e => { e.stopPropagation(); onSelect(); }} style={{ cursor: 'pointer' }}>
      <path
        d={catmullRomPath(pts)}
        fill="none"
        stroke="transparent"
        strokeWidth={12 / zoom}
        onDoubleClick={isSelected && onInsertWaypoint ? (e) => {
          e.stopPropagation();
          // Convert client coords to plan coords via SVG CTM
          const svg = (e.currentTarget as SVGPathElement).ownerSVGElement;
          if (!svg) return;
          const ctm = (e.currentTarget.parentNode as SVGGElement).getScreenCTM();
          if (!ctm) return;
          const inv = ctm.inverse();
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const planPt = pt.matrixTransform(inv);
          onInsertWaypoint(hose.id, { x: planPt.x, y: planPt.y });
        } : undefined}
      />
      <path
        d={catmullRomPath(pts)}
        fill="none"
        stroke={stroke}
        strokeWidth={3 / zoom}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Draggable waypoints on selected hose */}
      {isSelected && onMoveWaypoint && pts.map((p, i) => (
        <g key={i}>
          <DraggableWaypoint
            hoseId={hose.id}
            index={i}
            point={p}
            zoom={zoom}
            onMove={onMoveWaypoint}
            onMoveEnd={onMoveWaypointEnd}
            onRemove={onRemoveWaypoint}
            canRemove={pts.length > 2}
          />
        </g>
      ))}

      {/* Индикатор длины на выбранном рукаве */}
      {isSelected && maxLengthM && (
        <g transform={`translate(${midPt.x + 10 / zoom} ${midPt.y - 10 / zoom})`}>
          <rect
            x={0}
            y={-10 / zoom}
            width={110 / zoom}
            height={18 / zoom}
            rx={3 / zoom}
            fill={currentLenM > maxLengthM ? '#fecaca' : '#e0f2fe'}
            stroke={lengthColor}
            strokeWidth={1 / zoom}
          />
          <text
            x={6 / zoom}
            y={2 / zoom}
            fontSize={10 / zoom}
            fill={currentLenM > maxLengthM ? '#dc2626' : '#334155'}
            fontWeight="600"
          >
            {currentLenM.toFixed(1)} / {maxLengthM} м
          </text>
        </g>
      )}
    </g>
  );
}

/** Перетаскиваемая точка рукава. ПКМ — удалить точку. */
function DraggableWaypoint({
  hoseId,
  index,
  point,
  zoom,
  onMove,
  onMoveEnd,
  onRemove,
  canRemove,
}: {
  hoseId: string;
  index: number;
  point: Point;
  zoom: number;
  onMove: (hoseId: string, idx: number, pt: Point) => void;
  onMoveEnd?: (hoseId: string) => void;
  onRemove?: (hoseId: string, waypointIndex: number) => void;
  canRemove?: boolean;
}) {
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: point.x,
      startY: point.y,
    };
    (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startClientX) / zoom;
    const dy = (e.clientY - dragRef.current.startClientY) / zoom;
    onMove(hoseId, index, {
      x: dragRef.current.startX + dx,
      y: dragRef.current.startY + dy,
    });
  };
if (dragRef.current) {
      dragRef.current = null;
      onMoveEnd?.(hoseId);
    }
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={5 / zoom}
      fill="#3b82f6"
      stroke="#fff"
      strokeWidth={1.5 / zoom}
      style={{ cursor: 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={e => e.stopPropagation()}
      onContextMenu={canRemove && onRemove ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove(hoseId, index);
      } : (e) => e.preventDefault()}
    />
  );
}

function DrawingHoseOverlay({
  dh,
  cursorPlan,
  zoom,
  scale_m_per_px,
}: {
  dh: DrawingHose;
  cursorPlan: Point;
  zoom: number;
  scale_m_per_px: number;
}) {
  const wp = dh.waypoints;
  const lastPt = wp[wp.length - 1];

  const drawnM = polylineLength(wp) * scale_m_per_px;
  const previewSegM = Math.hypot(cursorPlan.x - lastPt.x, cursorPlan.y - lastPt.y) * scale_m_per_px;
  const totalM = drawnM + previewSegM;

  const remainM = Math.max(0, dh.max_length_m - totalM);
  const remainPct = (remainM / dh.max_length_m) * 100;

  const overLimit = totalM > dh.max_length_m;
  const color = overLimit ? '#ef4444' : hoseColor(remainPct);

  return (
    <g>
      {wp.length >= 2 && (
        <path
          d={catmullRomPath(wp)}
          fill="none"
          stroke={color}
          strokeWidth={3 / zoom}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {wp.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4 / zoom} fill={color} stroke="#fff" strokeWidth={1 / zoom} />
      ))}

      <line
        x1={lastPt.x}
        y1={lastPt.y}
        x2={cursorPlan.x}
        y2={cursorPlan.y}
        stroke={color}
        strokeWidth={2 / zoom}
        strokeDasharray={`${6 / zoom} ${4 / zoom}`}
        opacity={0.7}
      />

      <g transform={`translate(${cursorPlan.x + 14 / zoom} ${cursorPlan.y - 10 / zoom})`}>
        <rect
          x={0}
          y={-10 / zoom}
          width={100 / zoom}
          height={18 / zoom}
          rx={3 / zoom}
          fill={overLimit ? '#fecaca' : remainPct < 30 ? '#fef9c3' : '#dcfce7'}
          stroke={color}
          strokeWidth={1 / zoom}
        />
        <text
          x={6 / zoom}
          y={2 / zoom}
          fontSize={10 / zoom}
          fill={overLimit ? '#dc2626' : '#334155'}
          fontWeight="600"
        >
          {overLimit
            ? '🚫 лимит'
            : `⚡ ${remainM.toFixed(1)} м`}
        </text>
      </g>
    </g>
  );
}
