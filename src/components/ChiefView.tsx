import FireMapView from './FireMapView';

export default function ChiefView() {
  return (
    <FireMapView
      dataPrefix="/firemaps"
      equipmentEndpoint="/game_logics/car"
      hoseEndpoint="/game_logics/hose"
    />
  );
}