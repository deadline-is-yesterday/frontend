import { useState, useCallback, useRef } from 'react';
import type { MapLayout, EditorMode, Point, DrawingHose, HoseEndpoint } from '../../types/firemap';

const EMPTY_LAYOUT: MapLayout = {
  placed_equipment: [],
  placed_branchings: [],
  hoses: [],
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Fire-and-forget запрос к бэку для конца рукава. */
function syncHoseEndpoint(
  apiPath: string,
  method: 'POST' | 'PUT' | 'DELETE',
  id: string,
  endpoint?: { x: number; y: number },
) {
  if (!apiPath) return;
  fetch(`${API_BASE}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      x: endpoint?.x ?? 0,
      y: endpoint?.y ?? 0,
      angle: 0,
      enabled: true,
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
  /** Путь API для синхронизации рукавов (пустая строка = без синхронизации). */
  hoseEndpoint?: string;
  /** Путь API для синхронизации техники (пустая строка = без синхронизации). */
  equipmentEndpoint?: string;
}

export function useFireMapState(opts: FireMapStateOptions = {}) {
  const hoseApi = useRef(opts.hoseEndpoint ?? '');
  const eqApi = useRef(opts.equipmentEndpoint ?? '');
  hoseApi.current = opts.hoseEndpoint ?? '';
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
    setLayout(saved);
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
    setLayout(prev => ({
      ...prev,
      placed_equipment: prev.placed_equipment.map(e =>
        e.instance_id === instance_id ? { ...e, x, y } : e,
      ),
    }));
  }, []);

  const deleteObject = useCallback((instance_id: string) => {
    setLayout(prev => {
      // Определяем, что удаляем: технику или рукав
      const isEquipment = prev.placed_equipment.some(e => e.instance_id === instance_id);
      const isHose = prev.hoses.some(h => h.id === instance_id);

      if (isEquipment) {
        syncEquipmentEndpoint(eqApi.current, 'DELETE', instance_id);
        // Удаляем рукава, привязанные к этой технике
        prev.hoses
          .filter(h => h.equipment_instance_id === instance_id)
          .forEach(h => syncHoseEndpoint(hoseApi.current, 'DELETE', h.id));
      }
      if (isHose) syncHoseEndpoint(hoseApi.current, 'DELETE', instance_id);

      return {
        ...prev,
        placed_equipment: prev.placed_equipment.filter(e => e.instance_id !== instance_id),
        placed_branchings: prev.placed_branchings.filter(
          b => b.instance_id !== instance_id && b.equipment_instance_id !== instance_id,
        ),
        hoses: prev.hoses.filter(h => h.id !== instance_id && h.equipment_instance_id !== instance_id),
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

  /** Завершить рукав с endpoint (free / hydrant / branching). */
  const finishHose = useCallback(
    (endpoint: HoseEndpoint) => {
      if (!drawingHose) return;
      const id = crypto.randomUUID();
      setLayout(prev => ({
        ...prev,
        hoses: [
          ...prev.hoses,
          {
            id,
            equipment_instance_id: drawingHose.equipment_instance_id,
            hose_id: drawingHose.hose_id,
            waypoints: drawingHose.waypoints,
            endpoint,
          },
        ],
      }));
      syncHoseEndpoint(hoseApi.current, 'POST', id, { x: endpoint.x, y: endpoint.y });
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
        // Сохраняем снэпшот при первом перемещении
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

  /**
   * Откатить рукав к снэпшоту, если его длина превышает лимит.
   * Вызывается при снятии выделения.
   */
  const revertHoseIfOverLimit = useCallback(
    (maxLengthM: number, scale_m_per_px: number) => {
      const snap = hoseSnapshotRef.current;
      if (!snap) return;
      setLayout(prev => {
        const hose = prev.hoses.find(h => h.id === snap.hoseId);
        if (!hose) return prev;
        const lenM = polylineLength(hose.waypoints) * scale_m_per_px;
        if (lenM > maxLengthM) {
          // Откатываем
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
    syncHoseEndpoint(hoseApi.current, 'DELETE', hose_id);
    setLayout(prev => ({
      ...prev,
      hoses: prev.hoses.filter(h => h.id !== hose_id),
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
        // Синхронизируем с бэком
        const hose = updated.hoses.find(h => h.id === hose_id);
        if (hose) syncHoseEndpoint(hoseApi.current, 'PUT', hose_id, { x: hose.endpoint.x, y: hose.endpoint.y });
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
        if (hose) syncHoseEndpoint(hoseApi.current, 'PUT', hose_id, { x: hose.endpoint.x, y: hose.endpoint.y });
        return updated;
      });
    },
    [],
  );

  /** Отправить PUT на бэк для конца рукава (вызывать после завершения редактирования). */
  const syncHose = useCallback((hose_id: string) => {
    setLayout(prev => {
      const hose = prev.hoses.find(h => h.id === hose_id);
      if (hose) syncHoseEndpoint(hoseApi.current, 'PUT', hose_id, { x: hose.endpoint.x, y: hose.endpoint.y });
      return prev; // не меняем state
    });
  }, []);

  /** Отправить PUT на бэк после перемещения техники. */
  const syncEquipment = useCallback((instance_id: string) => {
    setLayout(prev => {
      const eq = prev.placed_equipment.find(e => e.instance_id === instance_id);
      if (eq) syncEquipmentEndpoint(eqApi.current, 'PUT', instance_id, { x: eq.x, y: eq.y });
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
  };
}
