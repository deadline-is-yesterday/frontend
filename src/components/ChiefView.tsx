import FireMapView from './FireMapView';
import type { FireSimState } from '../types/firesim';

export default function ChiefView({ simState }: { simState: FireSimState | null }) {
  return (
    <FireMapView
      dataPrefix="/headquarters"
      equipmentEndpoint="/hq_game_logic/car"
      hoseEndpoint="/hq_game_logic/hose"
      simState={simState}
    />
  );
}