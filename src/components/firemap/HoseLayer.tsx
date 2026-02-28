import type { PlacedHose, DrawingHose, Point } from '../../types/firemap';
import { polylineLength } from './useFireMapState';

interface HoseLayerProps {
  hoses: PlacedHose[];
  selectedId: string | null;
  zoom: number;
  scale_m_per_px: number;
  /** Рукав, который сейчас рисуется (null если нет). */
  drawingHose: DrawingHose | null;
  /** Текущая позиция курсора в координатах плана (для превью сегмента). */
  cursorPlan: Point;
  onSelect: (id: string) => void;
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
  if (remainPct > 30) return '#22c55e'; // зелёный
  if (remainPct > 10) return '#eab308'; // жёлтый
  return '#ef4444';                      // красный
}

export default function HoseLayer({
  hoses,
  selectedId,
  zoom,
  scale_m_per_px,
  drawingHose,
  cursorPlan,
  onSelect,
}: HoseLayerProps) {
  return (
    <g>
      {/* Существующие рукава */}
      {hoses.map(hose => (
        <g key={hose.id}>
          <ExistingHose
            hose={hose}
            isSelected={hose.id === selectedId}
            zoom={zoom}
            onSelect={() => onSelect(hose.id)}
          />
        </g>
      ))}

      {/* Рисуемый рукав */}
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
  onSelect,
}: {
  hose: PlacedHose;
  isSelected: boolean;
  zoom: number;
  onSelect: () => void;
}) {
  const pts = hose.waypoints;
  if (pts.length < 2) return null;

  const stroke = isSelected ? '#3b82f6' : '#22c55e';

  return (
    <g onClick={e => { e.stopPropagation(); onSelect(); }} style={{ cursor: 'pointer' }}>
      <path d={catmullRomPath(pts)} fill="none" stroke="transparent" strokeWidth={12 / zoom} />
      <path
        d={catmullRomPath(pts)}
        fill="none"
        stroke={stroke}
        strokeWidth={3 / zoom}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Точки waypoints — видны на выбранном рукаве */}
      {isSelected && pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4 / zoom}
          fill="#3b82f6"
          stroke="#fff"
          strokeWidth={1.5 / zoom}
        />
      ))}
    </g>
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

  // Длина уже проложенных сегментов в метрах
  const drawnM = polylineLength(wp) * scale_m_per_px;
  // Длина от последней точки до курсора
  const previewSegM = Math.hypot(cursorPlan.x - lastPt.x, cursorPlan.y - lastPt.y) * scale_m_per_px;
  const totalM = drawnM + previewSegM;

  const remainM = Math.max(0, dh.max_length_m - totalM);
  const remainPct = (remainM / dh.max_length_m) * 100;

  const overLimit = totalM > dh.max_length_m;
  const color = overLimit ? '#ef4444' : hoseColor(remainPct);

  return (
    <g>
      {/* Уже проложенная часть */}
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

      {/* Waypoint-точки */}
      {wp.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4 / zoom} fill={color} stroke="#fff" strokeWidth={1 / zoom} />
      ))}

      {/* Превью от последней точки до курсора — пунктир */}
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

      {/* Индикатор длины у курсора */}
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
