import FireMapView from './FireMapView';
import type { FireSimState } from '../types/firesim';

export default function ChiefView({ simState }: { simState: FireSimState | null }) {
  return (
    <FireMapView
      dataPrefix="/firemaps"
      equipmentEndpoint="/game_logics/car"
      hoseEndpoint="/game_logics/hose"
      simState={simState}
    />
  );
}