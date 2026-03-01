import FireMapView from './FireMapView';
import type { FireSimState } from '../types/firesim';

export default function ChiefView({ simState }: { simState: FireSimState | null }) {
  return <FireMapView mapId="default" simState={simState} />;
}
