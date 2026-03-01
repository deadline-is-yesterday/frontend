import { useState, useCallback, useRef } from 'react';
import type { MapLayout, EditorMode, Point, DrawingHose, HoseEndpoint, PlacedHoseEnd } from '../../types/firemap';

const EMPTY_LAYOUT: MapLayout = {
  placed_equipment: [],
  placed_branchings: [],
  hoses: [],
  hose_ends: [],
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
const DEFAULT_HOSE_END_SPREAD_DEG = 50;

/** Fire-and-forget запрос к бэку для рукава (только позиция). */
function syncHoseToBackend(
  apiPath: string,
  method: 'POST' | 'PUT' | 'DELETE',
  id: string,
  pos?: { x: number; y: number },
) {
  if (!apiPath) return;
  fetch(`${API_BASE}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, x: pos?.x ?? 0, y: pos?.y ?? 0 }),
  }).catch(() => {});
}

/** Fire-and-forget запрос к бэку для конца рукава. */
function syncHoseEndToBackend(
  apiPath: string,
  method: 'POST' | 'PUT' | 'DELETE',
  data: Partial<PlacedHoseEnd> & { id: string },
) {
  if (!apiPath) return;
  fetch(`${API_BASE}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      active: data.active ? 1 : 0,
    }),
  }).catch(() => {});
}

/** Fire-and-forget запрос к бэку для техники. */
function syncEquipmentEndpoint(
  apiPath: string,
  method: 'POST' | 'PUT' | 'DELETE',
  id: string,
  pos?: { x: number; y: number },
) {
  if (!apiPath) return;
  fetch(`${API_BASE}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, x: pos?.x ?? 0, y: pos?.y ?? 0 }),
  }).catch(() => {});
}

/** Евклидово расстояние между двумя точками. */
function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Суммарная длина ломаной (в пикселях плана). */
export function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += dist(pts[i], pts[i + 1]);
  return len;
}

/** Расстояние от точки до отрезка AB. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export interface FireMapStateOptions {
  /** Путь API для синхронизации рукавов, напр. '/hq_game_logic/hose'. */
  hoseEndpoint?: string;
  /** Путь API для синхронизации концов рукавов, напр. '/hq_game_logic/hose_end'. */
  hoseEndEndpoint?: string;
  /** Путь API для синхронизации техники, напр. '/hq_game_logic/car'. */
  equipmentEndpoint?: string;
}

export function useFireMapState(opts: FireMapStateOptions = {}) {
  const hoseApi = useRef(opts.hoseEndpoint ?? '');
  const hoseEndApi = useRef(opts.hoseEndEndpoint ?? '');
  const eqApi = useRef(opts.equipmentEndpoint ?? '');
  hoseApi.current = opts.hoseEndpoint ?? '';
  hoseEndApi.current = opts.hoseEndEndpoint ?? '';
  eqApi.current = opts.equipmentEndpoint ?? '';

  const [layout, setLayout] = useState<MapLayout>(EMPTY_LAYOUT);
  const [mode, setMode] = useState<EditorMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Рукав в процессе рисования. */
  const [drawingHose, setDrawingHose] = useState<DrawingHose | null>(null);

  /** Снэпшот waypoints рукава до начала редактирования. */
  const hoseSnapshotRef = useRef<{ hoseId: string; waypoints: Point[] } | null>(null);

  /** Загрузить сохранённую расстановку. */
  const loadLayout = useCallback((saved: MapLayout) => {
    setLayout({
      ...saved,
      hose_ends: (saved.hose_ends ?? []).map(he => ({
        ...he,
        spread_deg: he.spread_deg ?? DEFAULT_HOSE_END_SPREAD_DEG,
      })),
    });
    setSelectedId(null);
    setMode('select');
  }, []);

  const placeEquipment = useCallback((id: string, x: number, y: number) => {
    setLayout(prev => ({
      ...prev,
      placed_equipment: [...prev.placed_equipment, { instance_id: id, x, y }],
    }));
    syncEquipmentEndpoint(eqApi.current, 'POST', id, { x, y });
    return id;
  }, []);

  const moveEquipment = useCallback((instance_id: string, x: number, y: number) => {
    setLayout(prev => {
      const eq = prev.placed_equipment.find(e => e.instance_id === instance_id);
      if (!eq) return prev;

      // Запрещаем движение машины, если у неё уже развернут хотя бы один рукав.
      const hasDeployedHoses = prev.hoses.some(h => h.equipment_instance_id === instance_id);
      if (hasDeployedHoses) return prev;

      const dx = x - eq.x;
      const dy = y - eq.y;

      // Собираем id рукавов этой машины для сдвига hose_ends
      const eqHoseIds = new Set(
        prev.hoses.filter(h => h.equipment_instance_id === instance_id).map(h => h.id),
      );

      return {
        ...prev,
        placed_equipment: prev.placed_equipment.map(e =>
          e.instance_id === instance_id ? { ...e, x, y } : e,
        ),
        hoses: prev.hoses.map(h => {
          if (h.equipment_instance_id !== instance_id) return h;
          return {
            ...h,
            waypoints: h.waypoints.map(wp => ({ x: wp.x + dx, y: wp.y + dy })),
            endpoint: h.endpoint
              ? { ...h.endpoint, x: h.endpoint.x + dx, y: h.endpoint.y + dy }
              : null,
          };
        }),
        placed_branchings: prev.placed_branchings.map(b =>
          b.equipment_instance_id === instance_id
            ? { ...b, x: b.x + dx, y: b.y + dy }
            : b,
        ),
        // Сдвигаем концы рукавов этой машины
        hose_ends: prev.hose_ends.map(he =>
          eqHoseIds.has(he.placed_hose_id)
            ? {
                ...he,
                x: he.x + dx,
                y: he.y + dy,
                // Если конец был подключён к гидранту, при движении машины считаем
                // подключение сорванным и выключаем подачу.
                active: he.hydrant_id ? false : he.active,
              }
            : he,
        ),
      };
    });
  }, []);

  const deleteObject = useCallback((instance_id: string) => {
    setLayout(prev => {
      const isEquipment = prev.placed_equipment.some(e => e.instance_id === instance_id);
      const isHose = prev.hoses.some(h => h.id === instance_id);

      if (isEquipment) {
        syncEquipmentEndpoint(eqApi.current, 'DELETE', instance_id);
        prev.hoses
          .filter(h => h.equipment_instance_id === instance_id)
          .forEach(h => syncHoseToBackend(hoseApi.current, 'DELETE', h.id));
        // Концы рукавов удаляются автоматически на бэке при удалении рукава
      }
      if (isHose) syncHoseToBackend(hoseApi.current, 'DELETE', instance_id);

      // Собираем id удаляемых рукавов для очистки hose_ends
      const deletedHoseIds = new Set(
        isEquipment
          ? prev.hoses.filter(h => h.equipment_instance_id === instance_id).map(h => h.id)
          : isHose ? [instance_id] : [],
      );

      return {
        ...prev,
        placed_equipment: prev.placed_equipment.filter(e => e.instance_id !== instance_id),
        placed_branchings: prev.placed_branchings.filter(
          b => b.instance_id !== instance_id && b.equipment_instance_id !== instance_id,
        ),
        hoses: prev.hoses.filter(h => h.id !== instance_id && h.equipment_instance_id !== instance_id),
        hose_ends: prev.hose_ends.filter(he => !deletedHoseIds.has(he.placed_hose_id)),
      };
    });
    setSelectedId(id => (id === instance_id ? null : id));
  }, []);

  /** Начать рисование рукава от коннектора техники. */
  const startDrawHose = useCallback(
    (equipment_instance_id: string, hose_id: string, max_length_m: number, start: Point) => {
      setDrawingHose({
        equipment_instance_id,
        hose_id,
        max_length_m,
        waypoints: [start],
      });
      setMode('draw_hose');
      setSelectedId(null);
    },
    [],
  );

  /**
   * Добавить waypoint к рисуемому рукаву.
   * Возвращает false если лимит исчерпан.
   */
  const addWaypoint = useCallback(
    (point: Point, scale_m_per_px: number): boolean => {
      if (!drawingHose) return false;

      const currentLen = polylineLength(drawingHose.waypoints);
      const segLen = dist(drawingHose.waypoints[drawingHose.waypoints.length - 1], point);
      const newLenM = (currentLen + segLen) * scale_m_per_px;

      if (newLenM > drawingHose.max_length_m) return false;

      setDrawingHose(prev =>
        prev ? { ...prev, waypoints: [...prev.waypoints, point] } : null,
      );
      return true;
    },
    [drawingHose],
  );

  /** Завершить рукав с endpoint (free / hydrant / branching).
   *  Конечная точка endpoint автоматически добавляется как последний waypoint.
   *  Автоматически создаёт конец рукава (hose_end). */
  const finishHose = useCallback(
    (endpoint: HoseEndpoint) => {
      if (!drawingHose) return;
      const hoseId = crypto.randomUUID();
      const hoseEndId = crypto.randomUUID();
      const finalWaypoints = [...drawingHose.waypoints, { x: endpoint.x, y: endpoint.y }];

      const newHoseEnd: PlacedHoseEnd = {
        id: hoseEndId,
        placed_hose_id: hoseId,
        x: endpoint.x,
        y: endpoint.y,
        angle: 0,
        spread_deg: DEFAULT_HOSE_END_SPREAD_DEG,
        active: false,
        hydrant_id: endpoint.hydrant_id,
        vehicle_id: null,
      };

      setLayout(prev => ({
        ...prev,
        hoses: [
          ...prev.hoses,
          {
            id: hoseId,
            equipment_instance_id: drawingHose.equipment_instance_id,
            hose_id: drawingHose.hose_id,
            waypoints: finalWaypoints,
            endpoint,
          },
        ],
        hose_ends: [...prev.hose_ends, newHoseEnd],
      }));

      // Синхронизируем рукав (только позиция)
      syncHoseToBackend(hoseApi.current, 'POST', hoseId, { x: endpoint.x, y: endpoint.y });
      // Синхронизируем конец рукава
      syncHoseEndToBackend(hoseEndApi.current, 'POST', newHoseEnd);

      setDrawingHose(null);
      setMode('select');
    },
    [drawingHose],
  );

  /** Отменить рисование рукава. */
  const cancelHose = useCallback(() => {
    setDrawingHose(null);
    setMode('select');
  }, []);

  const placeBranching = useCallback(
    (branching_id: string, equipment_instance_id: string, x: number, y: number) => {
      setLayout(prev => ({
        ...prev,
        placed_branchings: [
          ...prev.placed_branchings,
          { instance_id: crypto.randomUUID(), branching_id, equipment_instance_id, x, y },
        ],
      }));
      setMode('select');
    },
    [],
  );

  /** Переместить переходник. */
  const moveBranching = useCallback((instance_id: string, x: number, y: number) => {
    setLayout(prev => ({
      ...prev,
      placed_branchings: prev.placed_branchings.map(b =>
        b.instance_id === instance_id ? { ...b, x, y } : b,
      ),
    }));
  }, []);

  /** Удалить переходник. */
  const deleteBranching = useCallback((instance_id: string) => {
    setLayout(prev => ({
      ...prev,
      placed_branchings: prev.placed_branchings.filter(b => b.instance_id !== instance_id),
    }));
    setSelectedId(id => (id === instance_id ? null : id));
  }, []);

  /** Сдвинуть waypoint существующего рукава. */
  const moveWaypoint = useCallback(
    (hose_id: string, waypointIndex: number, point: Point) => {
      setLayout(prev => {
        if (!hoseSnapshotRef.current || hoseSnapshotRef.current.hoseId !== hose_id) {
          const hose = prev.hoses.find(h => h.id === hose_id);
          if (hose) {
            hoseSnapshotRef.current = { hoseId: hose_id, waypoints: [...hose.waypoints] };
          }
        }
        return {
          ...prev,
          hoses: prev.hoses.map(h => {
            if (h.id !== hose_id) return h;
            const wp = [...h.waypoints];
            wp[waypointIndex] = point;
            return { ...h, waypoints: wp };
          }),
        };
      });
    },
    [],
  );

  /** Откатить рукав к снэпшоту, если его длина превышает лимит. */
  const revertHoseIfOverLimit = useCallback(
    (maxLengthM: number, scale_m_per_px: number) => {
      const snap = hoseSnapshotRef.current;
      if (!snap) return;
      setLayout(prev => {
        const hose = prev.hoses.find(h => h.id === snap.hoseId);
        if (!hose) return prev;
        const lenM = polylineLength(hose.waypoints) * scale_m_per_px;
        if (lenM > maxLengthM) {
          return {
            ...prev,
            hoses: prev.hoses.map(h =>
              h.id === snap.hoseId ? { ...h, waypoints: snap.waypoints } : h,
            ),
          };
        }
        return prev;
      });
      hoseSnapshotRef.current = null;
    },
    [],
  );

  /** Удалить конкретный рукав по id. */
  const deleteHose = useCallback((hose_id: string) => {
    syncHoseToBackend(hoseApi.current, 'DELETE', hose_id);
    // Концы рукава удаляются автоматически на бэке
    setLayout(prev => ({
      ...prev,
      hoses: prev.hoses.filter(h => h.id !== hose_id),
      hose_ends: prev.hose_ends.filter(he => he.placed_hose_id !== hose_id),
    }));
    setSelectedId(id => (id === hose_id ? null : id));
  }, []);

  /** Добавить waypoint к существующему рукаву (вставить между ближайшими). */
  const insertWaypoint = useCallback(
    (hose_id: string, point: Point) => {
      setLayout(prev => {
        const updated = {
          ...prev,
          hoses: prev.hoses.map(h => {
            if (h.id !== hose_id) return h;
            const wp = h.waypoints;
            let bestIdx = wp.length - 1;
            let bestDist = Infinity;
            for (let i = 0; i < wp.length - 1; i++) {
              const d = distToSegment(point, wp[i], wp[i + 1]);
              if (d < bestDist) {
                bestDist = d;
                bestIdx = i + 1;
              }
            }
            const newWp = [...wp];
            newWp.splice(bestIdx, 0, point);
            return { ...h, waypoints: newWp };
          }),
        };
        const hose = updated.hoses.find(h => h.id === hose_id);
        if (hose?.endpoint) {
          syncHoseToBackend(hoseApi.current, 'PUT', hose_id, { x: hose.endpoint.x, y: hose.endpoint.y });
        }
        return updated;
      });
    },
    [],
  );

  /** Удалить waypoint из рукава по индексу (если останется >= 2 точки). */
  const removeWaypoint = useCallback(
    (hose_id: string, waypointIndex: number) => {
      setLayout(prev => {
        const updated = {
          ...prev,
          hoses: prev.hoses.map(h => {
            if (h.id !== hose_id || h.waypoints.length <= 2) return h;
            const newWp = h.waypoints.filter((_, i) => i !== waypointIndex);
            return { ...h, waypoints: newWp };
          }),
        };
        const hose = updated.hoses.find(h => h.id === hose_id);
        if (hose?.endpoint) {
          syncHoseToBackend(hoseApi.current, 'PUT', hose_id, { x: hose.endpoint.x, y: hose.endpoint.y });
        }
        return updated;
      });
    },
    [],
  );

  /** Отправить PUT на бэк для рукава (вызывать после завершения редактирования). */
  const syncHose = useCallback((hose_id: string) => {
    setLayout(prev => {
      const hose = prev.hoses.find(h => h.id === hose_id);
      if (hose?.endpoint) {
        syncHoseToBackend(hoseApi.current, 'PUT', hose_id, { x: hose.endpoint.x, y: hose.endpoint.y });
      }
      return prev;
    });
  }, []);

  /** Отправить PUT на бэк после перемещения техники (+ все привязанные рукава и их концы). */
  const syncEquipment = useCallback((instance_id: string) => {
    setLayout(prev => {
      const eq = prev.placed_equipment.find(e => e.instance_id === instance_id);
      if (eq) syncEquipmentEndpoint(eqApi.current, 'PUT', instance_id, { x: eq.x, y: eq.y });

      const eqHoseIds = new Set(
        prev.hoses.filter(h => h.equipment_instance_id === instance_id).map(h => h.id),
      );
      // Синхронизируем рукава
      prev.hoses
        .filter(h => h.equipment_instance_id === instance_id)
        .forEach(h => {
          if (h.endpoint) syncHoseToBackend(hoseApi.current, 'PUT', h.id, { x: h.endpoint.x, y: h.endpoint.y });
        });
      // Синхронизируем концы рукавов
      prev.hose_ends
        .filter(he => eqHoseIds.has(he.placed_hose_id))
        .forEach(he => {
          syncHoseEndToBackend(hoseEndApi.current, 'PUT', he);
        });

      return prev;
    });
  }, []);

  // ===================== Операции с концами рукавов =====================

  /** Переключить active (вкл/выкл) конца рукава. */
  const toggleHoseEndActive = useCallback((hose_end_id: string) => {
    setLayout(prev => {
      const updated: MapLayout = {
        ...prev,
        hose_ends: prev.hose_ends.map(he => {
          if (he.id !== hose_end_id) return he;
          return { ...he, active: !he.active };
        }),
      };
      const he = updated.hose_ends.find(h => h.id === hose_end_id);
      if (he) syncHoseEndToBackend(hoseEndApi.current, 'PUT', he);
      return updated;
    });
  }, []);

  /** Установить угол полива конца рукава (без синхронизации). */
  const setHoseEndAngle = useCallback((hose_end_id: string, angle: number) => {
    setLayout(prev => ({
      ...prev,
      hose_ends: prev.hose_ends.map(he => {
        if (he.id !== hose_end_id) return he;
        return { ...he, angle };
      }),
    }));
  }, []);

  /** Установить угол разброса воды конца рукава (без синхронизации). */
  const setHoseEndSpread = useCallback((hose_end_id: string, spreadDeg: number) => {
    const nextSpread = Math.max(10, Math.min(140, Math.round(spreadDeg)));
    setLayout(prev => ({
      ...prev,
      hose_ends: prev.hose_ends.map(he => {
        if (he.id !== hose_end_id) return he;
        return { ...he, spread_deg: nextSpread };
      }),
    }));
  }, []);

  /** Синхронизировать конец рукава с бэком (вызывать после drag-end). */
  const syncHoseEnd = useCallback((hose_end_id: string) => {
    setLayout(prev => {
      const he = prev.hose_ends.find(h => h.id === hose_end_id);
      if (he) syncHoseEndToBackend(hoseEndApi.current, 'PUT', he);
      return prev;
    });
  }, []);

  return {
    layout,
    mode,
    setMode,
    selectedId,
    setSelectedId,
    drawingHose,
    loadLayout,
    placeEquipment,
    moveEquipment,
    deleteObject,
    startDrawHose,
    addWaypoint,
    finishHose,
    cancelHose,
    placeBranching,
    moveBranching,
    deleteBranching,
    moveWaypoint,
    revertHoseIfOverLimit,
    insertWaypoint,
    removeWaypoint,
    deleteHose,
    syncHose,
    syncEquipment,
    toggleHoseEndActive,
    setHoseEndAngle,
    setHoseEndSpread,
    syncHoseEnd,
  };
}
