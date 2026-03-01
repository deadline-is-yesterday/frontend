import FireMapView from './FireMapView';
import type { FireSimState } from '../types/firesim';
import type { UseFireSimReturn } from '../hooks/useFireSim';

export default function SquadView({ simState, fireSim }: { simState: FireSimState | null; fireSim: UseFireSimReturn }) {
  return (
    <FireMapView
      dataPrefix="/firemap"
      equipmentEndpoint="/game_logic/car"
      hoseEndpoint="/game_logic/hose"
      simState={simState}
      fireSim={fireSim}
    />
  );
}
