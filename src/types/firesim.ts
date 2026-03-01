export interface FireSource {
  x: number;
  y: number;
  intensity: number;
}

export interface ActiveWater {
  x: number;
  y: number;
}

export interface SimTruck {
  id: string;
  x: number;
  y: number;
  water: number;
  max_water: number;
  hose_open: boolean;
  hydrant_connected: boolean;
  hose_end: { x: number; y: number } | null;
}

/** Payload emitted by the server on each tick via `state_update` */
export interface FireSimState {
  grid: number[][];
  sources: FireSource[];
  active_water: ActiveWater[];
  trucks: SimTruck[];
  ticks: number;
}

/** Body for POST /firesim/start */
export interface StartSimPayload {
  map_id: string;
  width: number;
  height: number;
  walls: Array<{ x: number; y: number; hp: number }>;
  sources: Array<{ x: number; y: number; intensity: number }>;
  trucks: Array<{ id: string; x: number; y: number; water: number }>;
}

/** Body for POST /firesim/set_source */
export interface SetSourcePayload {
  map_id: string;
  x: number;
  y: number;
}

/** Body for POST /firesim/reset */
export interface ResetPayload {
  map_id: string;
}
