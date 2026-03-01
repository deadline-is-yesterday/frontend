import FireMapView from './FireMapView';
import type { FireSimState } from '../types/firesim';

export default function SquadView({ simState }: { simState: FireSimState | null }) {
  return (
    <FireMapView
      dataPrefix="/firemap"
      equipmentEndpoint="/game_logic/car"
      hoseEndpoint="/game_logic/hose"
      simState={simState}
    />
  );
}
