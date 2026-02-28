export type Point = { x: number; y: number };

// Данные от бекенда
export type HoseSpec = {
  id: string;
  max_length_m: number;
};

export type BranchingSpec = {
  id: string;
  type: 'two_way' | 'three_way' | 'four_way';
};

export type EquipmentSpec = {
  id: string;
  name: string;
  icon_path: string; // relative path → /ICONS/<icon_path>
  hoses: HoseSpec[];
  branchings: BranchingSpec[];
  /** Если != null — машина уже размещена на карте. */
  placement_id: string | null;
  x: number | null;
  y: number | null;
};

export type Hydrant = {
  id: string;
  x: number;
  y: number;
  label: string;
};

export type FireMap = {
  id: string;
  name: string;
  plan_url: string;
  scale_m_per_px: number;
  hydrants: Hydrant[];
};

// Состояние расстановки
export type PlacedEquipment = {
  instance_id: string; // = id конкретной машины из бэка
  x: number;
  y: number;
};

export type PlacedBranching = {
  instance_id: string;
  branching_id: string;
  equipment_instance_id: string;
  x: number;
  y: number;
};

export type HoseEndpoint = {
  type: 'free' | 'hydrant' | 'branching';
  x: number;
  y: number;
  hydrant_id: string | null;
  branching_instance_id: string | null;
};

export type PlacedHose = {
  id: string;
  equipment_instance_id: string;
  hose_id: string;
  waypoints: Point[];
  endpoint: HoseEndpoint | null;
};

export type MapLayout = {
  placed_equipment: PlacedEquipment[];
  placed_branchings: PlacedBranching[];
  hoses: PlacedHose[];
};

export type EditorMode =
  | 'select'
  | 'place_equipment'
  | 'draw_hose'
  | 'place_branching'
  | 'delete';

/** Рукав в процессе рисования (ещё не завершён). */
export type DrawingHose = {
  equipment_instance_id: string;
  hose_id: string;
  max_length_m: number;
  waypoints: Point[];
};
