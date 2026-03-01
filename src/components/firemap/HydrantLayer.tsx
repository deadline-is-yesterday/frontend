import type { Hydrant, PlacedHoseEnd } from '../../types/firemap';

interface HydrantLayerProps {
  hydrants: Hydrant[];
  zoom: number;
  /** Концы рукавов — для определения активных подключений к гидрантам. */
  hoseEnds?: PlacedHoseEnd[];
}

const BASE_R = 10;

export default function HydrantLayer({ hydrants, zoom, hoseEnds }: HydrantLayerProps) {
  // Радиус гидранта не уменьшается ниже BASE_R при малом масштабе
  const r = Math.max(BASE_R, BASE_R / zoom);

  return (
    <g>
      {hydrants.map(h => {
        const isConnectedActive = hoseEnds?.some(
          he => he.hydrant_id === h.id && he.active,
        ) ?? false;

        return (
          <g key={h.id} transform={`translate(${h.x} ${h.y})`}>
            {/* Пульсирующее кольцо при активном подключении */}
            {isConnectedActive && (
              <circle r={r} fill="none" stroke="#06b6d4" strokeWidth={2.5 / zoom} opacity={0.6}>
                <animate attributeName="r" from={r} to={r + 10 / zoom} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              r={r}
              fill={isConnectedActive ? '#06b6d4' : '#3b82f6'}
              stroke={isConnectedActive ? '#0891b2' : '#1d4ed8'}
              strokeWidth={1.5 / zoom}
              opacity={0.9}
            />
            <text
              y={r + 12 / zoom}
              textAnchor="middle"
              fontSize={11 / zoom}
              fill={isConnectedActive ? '#0891b2' : '#1d4ed8'}
              fontWeight="600"
            >
              {h.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
