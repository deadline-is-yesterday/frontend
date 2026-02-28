import type { Hydrant } from '../../types/firemap';

interface HydrantLayerProps {
  hydrants: Hydrant[];
  zoom: number;
}

const BASE_R = 10;

export default function HydrantLayer({ hydrants, zoom }: HydrantLayerProps) {
  // Радиус гидранта не уменьшается ниже BASE_R при малом масштабе
  const r = Math.max(BASE_R, BASE_R / zoom);

  return (
    <g>
      {hydrants.map(h => (
        <g key={h.id} transform={`translate(${h.x} ${h.y})`}>
          <circle r={r} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={1.5 / zoom} opacity={0.9} />
          <text
            y={r + 12 / zoom}
            textAnchor="middle"
            fontSize={11 / zoom}
            fill="#1d4ed8"
            fontWeight="600"
          >
            {h.label}
          </text>
        </g>
      ))}
    </g>
  );
}
