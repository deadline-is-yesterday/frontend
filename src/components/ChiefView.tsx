import FireMapView from './FireMapView';
import type { FireSimState } from '../types/firesim';

<<<<<<< HEAD
export default function ChiefView({ simState }: { simState: FireSimState | null }) {
  return <FireMapView mapId="default" simState={simState} />;
=======
export default function ChiefView() {
  return <FireMapView apiPrefix="/chief" />;
>>>>>>> 0e5ec85eb6749bbe2d10589a87f658c325bf4e4c
}
