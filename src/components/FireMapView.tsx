import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MousePointer2, Trash2, Save, ZoomIn, ZoomOut } from 'lucide-react';
import { useFireMapData } from './firemap/useFireMapData';
import { useFireMapState } from './firemap/useFireMapState';
import EquipmentPanel from './firemap/EquipmentPanel';
import EquipmentLayer from './firemap/EquipmentLayer';
import HydrantLayer from './firemap/HydrantLayer';
import HoseLayer from './firemap/HoseLayer';
import BranchingLayer, { getBranchingConnectors } from './firemap/BranchingLayer';
import type { EditorMode, EquipmentSpec, FireMap, HoseSpec } from '../types/firemap';
import type { FireSimState } from '../types/firesim';
import { iconUrl } from './firemap/iconUrl';
import FireGridLayer from './firemap/FireGridLayer';

interface FireMapViewProps {
  mapId: string;
  simState?: FireSimState | null;
}

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 5;
const ZOOM_STEP = 1.15;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export default function FireMapView({ mapId, simState }: FireMapViewProps) {
  const { map, equipment, savedLayout, loading } = useFireMapData(mapId);
  const {
    layout,
    mode,
    setMode,
    selectedId,
    setSelectedId,
    drawingHose,
    placeEquipment,
    moveEquipment,
    deleteObject,
    startDrawHose,
    addWaypoint,
    finishHose,
    cancelHose,
    deleteHose,
    moveWaypoint,
    revertHoseIfOverLimit,
    insertWaypoint,
    removeWaypoint,
    loadLayout,
    placeBranching,
    moveBranching,
    deleteBranching,
    syncHose,
    syncEquipment,
  } = useFireMapState();

  // Zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });

  // Режим "разместить технику" — какой id ожидает размещения
  const [pendingEquipmentId, setPendingEquipmentId] = useState<string | null>(null);
  // Режим "разместить переходник" — для какой техники instance_id
  const [pendingBranchingEqId, setPendingBranchingEqId] = useState<string | null>(null);
  // Позиция курсора в координатах плана (для ghost-иконки)
  const [cursorPlan, setCursorPlan] = useState({ x: 0, y: 0 });

  // Загрузить сохранённую расстановку + авто-размещение техники из бэка
  useEffect(() => {
    if (savedLayout) loadLayout(savedLayout);

    // Машины, у которых есть placed_id, x, y — авто-размещаем
    const prePlaced = equipment
      .filter(eq => eq.placed_id != null && eq.x != null && eq.y != null)
      .map(eq => ({ instance_id: eq.id, x: eq.x!, y: eq.y! }));
    if (prePlaced.length > 0) {
      loadLayout({
        placed_equipment: prePlaced,
        placed_branchings: savedLayout?.placed_branchings ?? [],
        hoses: savedLayout?.hoses ?? [],
      });
    }
  }, [savedLayout, equipment, loadLayout]);

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const isSpaceRef = useRef(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const isPanningRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  // Координаты клиента → координаты плана
  const toPlanCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgContainerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom],
  );

  // Keyboard: пробел для пана
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        isSpaceRef.current = true;
      }
      if (e.code === 'Escape') {
        setPendingEquipmentId(null);
        setPendingBranchingEqId(null);
        cancelHose();
        setMode('select');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') isSpaceRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setMode, cancelHose]);

  // Масштабирование колёсиком (zoom to cursor)
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = svgContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const planX = (cursorX - pan.x) / zoom;
      const planY = (cursorY - pan.y) / zoom;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newZoom = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX);
      setPan({ x: cursorX - planX * newZoom, y: cursorY - planY * newZoom });
      setZoom(newZoom);
    },
    [pan, zoom],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const isPanTrigger = isSpaceRef.current || e.button === 1;
      if (isPanTrigger) {
        isPanningRef.current = true;
        panStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX: pan.x, panY: pan.y };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    },
    [pan],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const planPos = toPlanCoords(e.clientX, e.clientY);
      setCursorPlan(planPos);

      if (isPanningRef.current && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.clientX;
        const dy = e.clientY - panStartRef.current.clientY;
        setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      }
    },
    [toPlanCoords],
  );

  const handlePointerUp = useCallback(() => {
    isPanningRef.current = false;
    panStartRef.current = null;
  }, []);

  /** Расстояние до ближайшего гидранта для snap. */
  const HYDRANT_SNAP_PX = 20;
  const BRANCHING_SNAP_PX = 15;

  const findNearbyHydrant = useCallback(
    (planPos: { x: number; y: number }) => {
      if (!map) return null;
      for (const h of map.hydrants) {
        const d = Math.hypot(h.x - planPos.x, h.y - planPos.y);
        if (d < HYDRANT_SNAP_PX) return h;
      }
      return null;
    },
    [map],
  );

  /** Найти ближайший вход переходника для snap рукава. */
  const findNearbyBranchingInput = useCallback(
    (planPos: { x: number; y: number }) => {
      for (const b of layout.placed_branchings) {
        const conn = getBranchingConnectors(b);
        const d = Math.hypot(conn.input.x - planPos.x, conn.input.y - planPos.y);
        if (d < BRANCHING_SNAP_PX) return { branching: b, point: conn.input };
      }
      return null;
    },
    [layout.placed_branchings],
  );

  // Клик на SVG-канвас (не на объект)
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanningRef.current) return;

      const planPos = toPlanCoords(e.clientX, e.clientY);

      if (mode === 'place_equipment' && pendingEquipmentId) {
        placeEquipment(pendingEquipmentId, planPos.x, planPos.y);
        return;
      }

      if (mode === 'place_branching' && pendingBranchingEqId) {
        placeBranching('three_way', pendingBranchingEqId, planPos.x, planPos.y);
        setPendingBranchingEqId(null);
        return;
      }

      if (mode === 'draw_hose' && map) {
        // Snap to branching input?
        const brSnap = findNearbyBranchingInput(planPos);
        if (brSnap) {
          addWaypoint(brSnap.point, map.scale_m_per_px);
          finishHose({
            type: 'branching',
            x: brSnap.point.x,
            y: brSnap.point.y,
            hydrant_id: null,
            branching_instance_id: brSnap.branching.instance_id,
          });
          return;
        }

        // Snap to hydrant?
        const hydrant = findNearbyHydrant(planPos);
        if (hydrant) {
          addWaypoint({ x: hydrant.x, y: hydrant.y }, map.scale_m_per_px);
          finishHose({ type: 'hydrant', x: hydrant.x, y: hydrant.y, hydrant_id: hydrant.id, branching_instance_id: null });
          return;
        }

        // Обычный клик — добавляем waypoint
        addWaypoint(planPos, map.scale_m_per_px);
        return;
      }

      // Клик на пустое место — снять выделение
      // Если был выделен рукав, проверить лимит длины
      if (selectedId && map) {
        const hose = layout.hoses.find(h => h.id === selectedId);
        if (hose) {
          const eq = layout.placed_equipment.find(e => e.instance_id === hose.equipment_instance_id);
          const spec = eq ? equipment.find(s => s.id === eq.instance_id) : null;
          const maxLen = spec?.hoses.find(h => h.id === hose.hose_id)?.max_length_m;
          if (maxLen) revertHoseIfOverLimit(maxLen, map.scale_m_per_px);
        }
      }
      setSelectedId(null);
    },
    [mode, pendingEquipmentId, pendingBranchingEqId, toPlanCoords, placeEquipment, placeBranching, setSelectedId, addWaypoint, finishHose, findNearbyHydrant, findNearbyBranchingInput, map, selectedId, layout, equipment, revertHoseIfOverLimit],
  );

  // ПКМ — завершить рукав в свободной точке
  const handleSvgContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (mode !== 'draw_hose' || !drawingHose) return;
      const planPos = toPlanCoords(e.clientX, e.clientY);
      addWaypoint(planPos, map?.scale_m_per_px ?? 0.05);
      finishHose({ type: 'free', x: planPos.x, y: planPos.y, hydrant_id: null, branching_instance_id: null });
    },
    [mode, drawingHose, toPlanCoords, finishHose, addWaypoint, map],
  );

  const handleEquipmentPanelSelect = useCallback(
    (id: string) => {
      setPendingEquipmentId(prev => (prev === id ? null : id));
      setMode('place_equipment');
      setSelectedId(null);
    },
    [setMode, setSelectedId],
  );

  const handleToolbarMode = useCallback(
    (m: EditorMode) => {
      setMode(m);
      setPendingEquipmentId(null);
      setPendingBranchingEqId(null);
      cancelHose();
      if (m !== 'select') setSelectedId(null);
    },
    [setMode, setSelectedId, cancelHose],
  );

  /** Клик по свободному коннектору — начать рисование рукава. */
  const handleConnectorClick = useCallback(
    (equipmentInstanceId: string, hoseSpec: HoseSpec, startX: number, startY: number) => {
      setPendingEquipmentId(null);
      setPendingBranchingEqId(null);
      startDrawHose(equipmentInstanceId, hoseSpec.id, hoseSpec.max_length_m, { x: startX, y: startY });
    },
    [startDrawHose],
  );

  /** Клик по выходному коннектору переходника — рисуем рукав от него. */
  const handleBranchingOutputClick = useCallback(
    (_branchingInstanceId: string, x: number, y: number) => {
      // Рукав от переходника — используем дефолтный лимит 60 м
      setPendingEquipmentId(null);
      setPendingBranchingEqId(null);
      startDrawHose(_branchingInstanceId, `branching_out_${Date.now()}`, 60, { x, y });
    },
    [startDrawHose],
  );

  /** Кнопка "Разместить переходник" в PropertiesPanel. */
  const handlePlaceBranching = useCallback(
    (equipmentInstanceId: string) => {
      setPendingBranchingEqId(equipmentInstanceId);
      setPendingEquipmentId(null);
      cancelHose();
      setMode('place_branching');
    },
    [setMode, cancelHose],
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedId) deleteObject(selectedId);
  }, [selectedId, deleteObject]);

  const handleSave = async () => {
    if (!map) return;
    setIsSaving(true);
    try {
      await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:5000'}/firemap/maps/${map.id}/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      });
    } catch {
      // игнорируем — бек ещё не готов
    } finally {
      setIsSaving(false);
    }
  };

  const selectedSpec = selectedId
    ? equipment.find(
        s =>
          s.id ===
          layout.placed_equipment.find(e => e.instance_id === selectedId)?.instance_id,
      )
    : null;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Загрузка карты…
      </div>
    );
  }

  const cursor =
    mode === 'draw_hose'
      ? 'crosshair'
      : mode === 'place_equipment' && pendingEquipmentId
        ? 'crosshair'
        : mode === 'place_branching'
          ? 'crosshair'
          : isPanningRef.current || isSpaceRef.current
            ? 'grab'
            : mode === 'delete'
              ? 'not-allowed'
              : 'default';

  return (
    <div className="flex flex-col h-full">
      {/* Тулбар */}
      <Toolbar
        mode={mode}
        zoom={zoom}
        isSaving={isSaving}
        hasSelection={!!selectedId}
        onMode={handleToolbarMode}
        onDelete={handleDeleteSelected}
        onSave={handleSave}
        onZoomIn={() => setZoom(z => clamp(z * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
        onZoomOut={() => setZoom(z => clamp(z / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель — список техники */}
        <EquipmentPanel
          equipment={equipment}
          placedIds={layout.placed_equipment.map(e => e.instance_id)}
          pendingEquipmentId={pendingEquipmentId}
          onSelect={handleEquipmentPanelSelect}
        />

        {/* SVG-канвас */}
        <div
          ref={svgContainerRef}
          className="flex-1 overflow-hidden bg-slate-200 relative"
          style={{ cursor }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <svg
            className="w-full h-full"
            onClick={handleSvgClick}
            onContextMenu={handleSvgContextMenu}
            style={{ display: 'block' }}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {/* Фон плана */}
              <MapBackground map={map} />

              {/* Наложение симуляции огня */}
              {simState?.grid && (
                <FireGridLayer
                  grid={simState.grid}
                  planWidth={800}
                  planHeight={600}
                />
              )}

              {/* Слои */}
              <HoseLayer
                hoses={layout.hoses}
                selectedId={selectedId}
                zoom={zoom}
                scale_m_per_px={map?.scale_m_per_px ?? 0.05}
                drawingHose={drawingHose}
                cursorPlan={cursorPlan}
                onSelect={id => {
                  setSelectedId(id);
                  setMode('select');
                }}
                onMoveWaypoint={moveWaypoint}
                onMoveWaypointEnd={syncHose}
                selectedHoseMaxLength={(() => {
                  if (!selectedId) return undefined;
                  const hose = layout.hoses.find(h => h.id === selectedId);
                  if (!hose) return undefined;
                  const eq = layout.placed_equipment.find(e => e.instance_id === hose.equipment_instance_id);
                  if (!eq) return undefined;
                  const spec = equipment.find(s => s.id === eq.instance_id);
                  return spec?.hoses.find(h => h.id === hose.hose_id)?.max_length_m;
                })()}
                onInsertWaypoint={insertWaypoint}
                onRemoveWaypoint={removeWaypoint}
              />
              {map && <HydrantLayer hydrants={map.hydrants} zoom={zoom} />}
              <EquipmentLayer
                placedEquipment={layout.placed_equipment}
                equipmentSpecs={equipment}
                hoses={layout.hoses}
                selectedId={selectedId}
                zoom={zoom}
                mode={mode}
                onSelect={id => {
                  if (mode === 'delete') {
                    deleteObject(id);
                  } else {
                    setSelectedId(id);
                    setMode('select');
                  }
                }}
                onMove={moveEquipment}
                onMoveEnd={syncEquipment}
                onConnectorClick={handleConnectorClick}
              />

              <BranchingLayer
                branchings={layout.placed_branchings}
                hoses={layout.hoses}
                selectedId={selectedId}
                zoom={zoom}
                mode={mode}
                onSelect={id => {
                  if (mode === 'delete') {
                    deleteBranching(id);
                  } else {
                    setSelectedId(id);
                    setMode('select');
                  }
                }}
                onMove={moveBranching}
                onOutputClick={handleBranchingOutputClick}
              />

              {/* Ghost-иконка при размещении */}
              {mode === 'place_equipment' && pendingEquipmentId && (
                <GhostEquipment
                  spec={equipment.find(s => s.id === pendingEquipmentId)}
                  x={cursorPlan.x}
                  y={cursorPlan.y}
                  zoom={zoom}
                />
              )}
            </g>
          </svg>
        </div>

        {/* Правая панель — свойства выбранного объекта */}
        {selectedSpec && selectedId && (
          <PropertiesPanel
            spec={selectedSpec}
            instanceId={selectedId}
            onDelete={() => deleteObject(selectedId)}
            onPlaceBranching={() => handlePlaceBranching(selectedId)}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Вспомогательные компоненты
// ---------------------------------------------------------------------------

function Toolbar({
  mode,
  zoom,
  isSaving,
  hasSelection,
  onMode,
  onDelete,
  onSave,
  onZoomIn,
  onZoomOut,
}: {
  mode: EditorMode;
  zoom: number;
  isSaving: boolean;
  hasSelection: boolean;
  onMode: (m: EditorMode) => void;
  onDelete: () => void;
  onSave: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border-b border-slate-700 text-white flex-shrink-0">
      <ToolButton active={mode === 'select'} onClick={() => onMode('select')} title="Выбор (Esc)">
        <MousePointer2 className="w-4 h-4" />
        <span className="text-xs">Выбор</span>
      </ToolButton>

      <ToolButton active={mode === 'delete'} onClick={() => onMode('delete')} title="Удалить объект">
        <Trash2 className="w-4 h-4" />
        <span className="text-xs">Удалить</span>
      </ToolButton>

      {hasSelection && mode === 'select' && (
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-500 transition-colors"
          title="Удалить выбранный объект"
        >
          <Trash2 className="w-3 h-3" />
          Удалить выбранный
        </button>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="p-1 hover:bg-slate-700 rounded"
          title="Уменьшить"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs w-14 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="p-1 hover:bg-slate-700 rounded"
          title="Увеличить"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
      >
        <Save className="w-3 h-3" />
        {isSaving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function MapBackground({ map }: { map: FireMap | null }) {
  if (!map) return null;

  if (map.plan_url) {
    return <image href={map.plan_url} x={0} y={0} preserveAspectRatio="xMinYMin meet" />;
  }

  // Мок-фон: серая сетка
  return (
    <>
      <rect x={0} y={0} width={800} height={600} fill="#f8fafc" rx={4} />
      {/* Горизонтальные линии */}
      {Array.from({ length: 13 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 50} x2={800} y2={i * 50} stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {/* Вертикальные линии */}
      {Array.from({ length: 17 }, (_, i) => (
        <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={600} stroke="#e2e8f0" strokeWidth={1} />
      ))}
      <rect x={0} y={0} width={800} height={600} fill="none" stroke="#cbd5e1" strokeWidth={2} rx={4} />
      <text x={400} y={300} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="#94a3b8">
        {map.name}
      </text>
    </>
  );
}

function GhostEquipment({
  spec,
  x,
  y,
  zoom,
}: {
  spec: EquipmentSpec | undefined;
  x: number;
  y: number;
  zoom: number;
}) {
  if (!spec) return null;
  const size = Math.max(40, 40 / zoom);
  const half = size / 2;
  return (
    <g transform={`translate(${x} ${y})`} opacity={0.6} style={{ pointerEvents: 'none' }}>
      <image
        href={iconUrl(spec.icon_path)}
        x={-half}
        y={-half}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
}

function PropertiesPanel({
  spec,
  instanceId,
  onDelete,
  onPlaceBranching,
}: {
  spec: EquipmentSpec;
  instanceId: string;
  onDelete: () => void;
  onPlaceBranching: () => void;
}) {
  return (
    <div className="w-56 bg-white border-l border-slate-200 flex flex-col overflow-y-auto">
      <div className="px-3 py-2 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Свойства
        </span>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">{spec.name}</div>
          <div className="text-xs text-slate-400 mt-0.5 font-mono break-all">{instanceId.slice(0, 8)}…</div>
        </div>

        {spec.hoses.length > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Рукава</div>
            {spec.hoses.map(h => (
              <div key={h.id} className="text-xs text-slate-700 flex justify-between">
                <span>{h.id}</span>
                <span className="text-slate-400">{h.max_length_m} м</span>
              </div>
            ))}
          </div>
        )}

        {spec.branchings.length > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">Переходники</div>
            {spec.branchings.map(b => (
              <div key={b.id} className="text-xs text-slate-700">
                {b.type === 'two_way' && '2-ходовой'}
                {b.type === 'three_way' && '3-ходовой'}
                {b.type === 'four_way' && '4-ходовой'}
              </div>
            ))}
            <button
              onClick={onPlaceBranching}
              className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
            >
              + Разместить переходник
            </button>
          </div>
        )}

        <button
          onClick={onDelete}
          className="mt-auto flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Удалить объект
        </button>
      </div>
    </div>
  );
}
