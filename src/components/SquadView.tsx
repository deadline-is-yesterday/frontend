import FireMapView from './FireMapView';

export default function SquadView() {
  return (
    <FireMapView
      dataPrefix="/firemap"
      equipmentEndpoint="/game_logic/car"
      hoseEndpoint="/game_logic/hose"
    />
  );
}
