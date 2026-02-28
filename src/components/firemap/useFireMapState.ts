import { useState, useCallback } from 'react';
import type { MapLayout, EditorMode, Point, DrawingHose, HoseEndpoint } from '../../types/firemap';

const EMPTY_LAYOUT: MapLayout = {
  placed_equipment: [],
  placed_branchings: [],
  hoses: [],
};

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

export function useFireMapState() {
  const [layout, setLayout] = useState<MapLayout>(EMPTY_LAYOUT);
  const [mode, setMode] = useState<EditorMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Рукав в процессе рисования. */
  const [drawingHose, setDrawingHose] = useState<DrawingHose | null>(null);

  /** Загрузить сохранённую расстановку. */
  const loadLayout = useCallback((saved: MapLayout) => {
    setLayout(saved);
    setSelectedId(null);
    setMode('select');
  }, []);

  const placeEquipment = useCallback((equipment_id: string, x: number, y: number) => {
    const instance_id = crypto.randomUUID();
    setLayout(prev => ({
      ...prev,
      placed_equipment: [...prev.placed_equipment, { instance_id, equipment_id, x, y }],
    }));
    return instance_id;
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
    setLayout(prev => ({
      ...prev,
      placed_equipment: prev.placed_equipment.filter(e => e.instance_id !== instance_id),
      placed_branchings: prev.placed_branchings.filter(
        b => b.equipment_instance_id !== instance_id,
      ),
      hoses: prev.hoses.filter(h => h.equipment_instance_id !== instance_id),
    }));
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
      setLayout(prev => ({
        ...prev,
        hoses: [
          ...prev.hoses,
          {
            id: crypto.randomUUID(),
            equipment_instance_id: drawingHose.equipment_instance_id,
            hose_id: drawingHose.hose_id,
            waypoints: drawingHose.waypoints,
            endpoint,
          },
        ],
      }));
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
      setLayout(prev => ({
        ...prev,
        hoses: prev.hoses.map(h => {
          if (h.id !== hose_id) return h;
          const wp = [...h.waypoints];
          wp[waypointIndex] = point;
          return { ...h, waypoints: wp };
        }),
      }));
    },
    [],
  );

  /** Удалить конкретный рукав по id. */
  const deleteHose = useCallback((hose_id: string) => {
    setLayout(prev => ({
      ...prev,
      hoses: prev.hoses.filter(h => h.id !== hose_id),
    }));
    setSelectedId(id => (id === hose_id ? null : id));
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
    deleteHose,
  };
}
