export type Role = 'instructor' | 'dispatcher' | 'rtp' | 'squad' | 'chief';

export type Point = { x: number; y: number };

export type ZoneType = 'fire_origin' | 'fire_zone' | 'temp_zone' | 'smoke_zone' | 'building' | 'fence' | 'terrain';

export type Zone = {
  id: string;
  type: ZoneType;
  points: Point[];
};

export type ScenarioState = {
  temperature: number;
  windDirection: number;
  windSpeed: number;
  timeOfDay: string;
  waterSupplyWorking: boolean;
  northDirection: number;
  incidentLocation: [number, number] | null;
  simulationStarted: boolean;
  triggerType: 'call' | 'sensor';
};
