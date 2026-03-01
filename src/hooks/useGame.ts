import { useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

// ── Types ────────────────────────────────────────────────────────────────────

export type CellType = 'empty' | 'wall' | 'fire' | 'water' | 'door' | 'window';

export interface GridState {
  resolution: number;
  grid_rows: number;
  aspect_ratio: number;
  grid: CellType[][];
  scale_m_per_px: number | null;
}

export interface ScenarioPayload {
  temperature: number;
  wind_speed: number;
  wind_direction: number;
  target_address: string;
}

export interface DepotPayload {
  vehicles: Record<string, number>;
}

export interface GameStatus {
  active_game_id: string;
  is_running: boolean;
}

export interface VehicleType {
  key: string;
  name: string;
  water_capacity_l: number;
  foam_capacity_l: number;
  pump_flow_ls: number;
  crew_size: number;
  ladder_height_m: number | null;
  count: number;
}

export interface GameInfo {
  id: string;
  name: string;
  created_at: string;
  status: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGame() {

  const createGame = useCallback(async (name: string = ''): Promise<{ game_id: string }> => {
    const res = await fetch(`${API_BASE}/game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  }, []);

  const listGames = useCallback(async (): Promise<GameInfo[]> => {
    try {
      const res = await fetch(`${API_BASE}/game/list`);
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  }, []);

  const getStatus = useCallback(async (): Promise<GameStatus> => {
    const res = await fetch(`${API_BASE}/game/status`);
    return res.json();
  }, []);

  const loadVehicleTypes = useCallback(async (): Promise<VehicleType[]> => {
    try {
      const res = await fetch(`${API_BASE}/game/vehicle_types`);
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  }, []);

  // ── Plan ────────────────────────────────────────────────────────────────

  const loadPlan = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/firemap/maps/plan.png`, { method: 'HEAD' });
      if (!res.ok) return null;
      return `${API_BASE}/firemap/maps/plan.png`;
    } catch {
      return null;
    }
  }, []);

  const uploadPlan = useCallback(async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/game/plan`, {
      method: 'POST',
      body: form,
    });
    return res.json();
  }, []);

  // ── Grid ────────────────────────────────────────────────────────────────

  const loadGrid = useCallback(async (): Promise<GridState | null> => {
    try {
      const res = await fetch(`${API_BASE}/game/map`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.resolution) return null;
      return data;
    } catch {
      return null;
    }
  }, []);

  const saveGrid = useCallback(async (payload: GridState) => {
    fetch(`${API_BASE}/game/map`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, []);

  // ── Scenario ────────────────────────────────────────────────────────────

  const loadScenario = useCallback(async (): Promise<ScenarioPayload | null> => {
    try {
      const res = await fetch(`${API_BASE}/game/scenario`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.temperature && data.temperature !== 0) return null;
      return data;
    } catch {
      return null;
    }
  }, []);

  const saveScenario = useCallback(async (payload: ScenarioPayload) => {
    fetch(`${API_BASE}/game/scenario`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, []);

  // ── Depot ───────────────────────────────────────────────────────────────

  const loadDepot = useCallback(async (): Promise<Record<string, number> | null> => {
    try {
      const res = await fetch(`${API_BASE}/game/depot`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.vehicles ?? null;
    } catch {
      return null;
    }
  }, []);

  const saveDepot = useCallback(async (vehicles: Record<string, number>) => {
    fetch(`${API_BASE}/game/depot`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicles }),
    }).catch(() => {});
  }, []);

  return {
    createGame,
    listGames,
    getStatus,
    loadVehicleTypes,
    loadPlan,
    uploadPlan,
    loadGrid,
    saveGrid,
    loadScenario,
    saveScenario,
    loadDepot,
    saveDepot,
  };
}
