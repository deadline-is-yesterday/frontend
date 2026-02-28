import React, { useCallback, useRef } from 'react';
import type { PlacedEquipment, EquipmentSpec, PlacedHose, HoseSpec } from '../../types/firemap';
import { iconUrl } from './iconUrl';

interface EquipmentLayerProps {
  placedEquipment: PlacedEquipment[];
  equipmentSpecs: EquipmentSpec[];
  /** Уже размещённые рукава — для определения занятых коннекторов. */
  hoses: PlacedHose[];
  selectedId: string | null;
  zoom: number;
  mode: string;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  /** Клик по свободному коннектору рукава. */
  onConnectorClick: (equipmentInstanceId: string, hoseSpec: HoseSpec, startX: number, startY: number) => void;
}

/** Базовый размер иконки в координатах плана. Не уменьшаем при zoom < 0.6. */
const BASE_ICON_SIZE = 40;

export default function EquipmentLayer({
  placedEquipment,
  equipmentSpecs,
  hoses,
  selectedId,
  zoom,
  mode,
  onSelect,
  onMove,
  onConnectorClick,
}: EquipmentLayerProps) {
  const dragState = useRef<{
    instanceId: string;
    startPlanX: number;
    startPlanY: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  const iconSize = zoom < 0.6 ? BASE_ICON_SIZE / zoom : BASE_ICON_SIZE;

  const specById = useCallback(
    (id: string) => equipmentSpecs.find(s => s.id === id),
    [equipmentSpecs],
  );

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>, eq: PlacedEquipment) => {
    if (mode !== 'select') return;
    e.stopPropagation();
    onSelect(eq.instance_id);
    dragState.current = {
      instanceId: eq.instance_id,
      startPlanX: eq.x,
      startPlanY: eq.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!dragState.current) return;
    const dx = (e.clientX - dragState.current.startClientX) / zoom;
    const dy = (e.clientY - dragState.current.startClientY) / zoom;
    onMove(
      dragState.current.instanceId,
      dragState.current.startPlanX + dx,
      dragState.current.startPlanY + dy,
    );
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  return (
    <g>
      {placedEquipment.map(eq => {
        const spec = specById(eq.equipment_id);
        const half = iconSize / 2;
        const isSelected = eq.instance_id === selectedId;

        return (
          <g
            key={eq.instance_id}
            transform={`translate(${eq.x} ${eq.y})`}
            style={{ cursor: mode === 'select' ? 'move' : 'default' }}
            onPointerDown={e => handlePointerDown(e, eq)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={e => e.stopPropagation()}
          >
            {/* Подсветка выбранного объекта */}
            {isSelected && (
              <rect
                x={-half - 4}
                y={-half - 4}
                width={iconSize + 8}
                height={iconSize + 8}
                rx={4}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2 / zoom}
                strokeDasharray={`${5 / zoom} ${3 / zoom}`}
              />
            )}

            {spec?.icon_path ? (
              <image
                href={iconUrl(spec.icon_path)}
                x={-half}
                y={-half}
                width={iconSize}
                height={iconSize}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              // Запасной прямоугольник если иконка не загружена
              <rect
                x={-half}
                y={-half}
                width={iconSize}
                height={iconSize}
                rx={4}
                fill="#e2e8f0"
                stroke="#94a3b8"
                strokeWidth={1 / zoom}
              />
            )}

            {spec && (
              <text
                y={half + 12 / zoom}
                textAnchor="middle"
                fontSize={10 / zoom}
                fill="#334155"
                fontWeight="500"
              >
                {spec.name}
              </text>
            )}

            {/* Коннекторы рукавов — показываются на выбранной технике */}
            {isSelected && spec && (
              <Connectors
                spec={spec}
                eq={eq}
                hoses={hoses}
                half={half}
                zoom={zoom}
                onConnectorClick={onConnectorClick}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Коннекторы — маленькие кружки вокруг иконки техники.
 * Свободные (без подключённого рукава) — зелёные, занятые — серые.
 */
function Connectors({
  spec,
  eq,
  hoses,
  half,
  zoom,
  onConnectorClick,
}: {
  spec: EquipmentSpec;
  eq: PlacedEquipment;
  hoses: PlacedHose[];
  half: number;
  zoom: number;
  onConnectorClick: EquipmentLayerProps['onConnectorClick'];
}) {
  const r = 6 / zoom;
  const usedHoseIds = new Set(
    hoses
      .filter(h => h.equipment_instance_id === eq.instance_id)
      .map(h => h.hose_id),
  );

  return (
    <g>
      {spec.hoses.map((hs, i) => {
        const isFree = !usedHoseIds.has(hs.id);
        // Располагаем коннекторы равномерно вдоль нижнего края
        const n = spec.hoses.length;
        const cx = n === 1 ? 0 : -half + (half * 2 * (i + 0.5)) / n;
        const cy = half + r + 2;

        return (
          <circle
            key={hs.id}
            cx={cx}
            cy={cy}
            r={r}
            fill={isFree ? '#22c55e' : '#94a3b8'}
            stroke={isFree ? '#16a34a' : '#64748b'}
            strokeWidth={1.5 / zoom}
            style={{ cursor: isFree ? 'pointer' : 'not-allowed' }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              if (isFree) {
                // Координаты коннектора в системе плана
                onConnectorClick(eq.instance_id, hs, eq.x + cx, eq.y + cy);
              }
            }}
          >
            {isFree && (
              <title>{`${hs.id}: ${hs.max_length_m} м`}</title>
            )}
          </circle>
        );
      })}
    </g>
  );
}