import FireMapView from './FireMapView';
import type { FireSimState } from '../types/firesim';
import type { MapLayout } from '../types/firemap';

interface ChiefViewProps {
  simState: FireSimState | null;
  onShareLayout?: (layout: MapLayout) => void;
}

export default function ChiefView({ simState, onShareLayout }: ChiefViewProps) {
  return (
    <FireMapView
      dataPrefix="/firemaps"
      equipmentEndpoint="/game_logics/car"
      hoseEndpoint="/game_logics/hose"
      simState={simState}
      onShareLayout={onShareLayout}
    />
  );
}