import FireMapView from './FireMapView';
import type { FireSimState } from '../types/firesim';
import type { UseFireSimReturn } from '../hooks/useFireSim';
import type { MapLayout } from '../types/firemap';

interface ChiefViewProps {
  simState: FireSimState | null;
  fireSim: UseFireSimReturn;
  onShareLayout?: (layout: MapLayout) => void;
}

export default function ChiefView({ simState, fireSim, onShareLayout }: ChiefViewProps) {
  return (
    <FireMapView
      dataPrefix="/headquarters"
      equipmentEndpoint="/hq_game_logic/car"
      hoseEndpoint="/hq_game_logic/hose"
      simState={simState}
      fireSim={fireSim}
      onShareLayout={onShareLayout}
    />
  );
}
