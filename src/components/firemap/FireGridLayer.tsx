import React from 'react';

interface FireGridLayerProps {
  grid: number[][];
  planWidth: number;
  planHeight: number;
  minTemp?: number;
  maxTemp?: number;
}

function tempToColor(temp: number, minT: number, maxT: number): string | null {
  if (temp <= minT) return null;
  const t = Math.min((temp - minT) / (maxT - minT), 1);
  const r = 255;
  const g = Math.round(255 * (1 - t * 0.8));
  const b = 0;
  const a = 0.15 + t * 0.55;
  return `rgba(${r},${g},${b},${a})`;
}

const FireGridLayer: React.FC<FireGridLayerProps> = React.memo(
  ({ grid, planWidth, planHeight, minTemp = 25, maxTemp = 800 }) => {
    if (!grid.length || !grid[0].length) return null;

    const rows = grid.length;
    const cols = grid[0].length;
    const cellW = planWidth / cols;
    const cellH = planHeight / rows;

    const rects: React.ReactNode[] = [];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const color = tempToColor(grid[y][x], minTemp, maxTemp);
        if (!color) continue;
        rects.push(
          <rect
            key={`${y}-${x}`}
            x={x * cellW}
            y={y * cellH}
            width={cellW}
            height={cellH}
            fill={color}
          />,
        );
      }
    }

    return <g className="fire-grid-layer">{rects}</g>;
  },
);

FireGridLayer.displayName = 'FireGridLayer';

export default FireGridLayer;
