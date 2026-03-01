import { useState } from 'react';
import InstructorView from './components/InstructorView';
import DispatcherView from './components/DispatcherView';
import RTPView from './components/RTPView';
import SquadView from './components/SquadView';
import ChiefView from './components/ChiefView';
import CommunicationPanel from './components/CommunicationPanel';
import LobbyScreen from './components/LobbyScreen';
import { useSocket } from './hooks/useSocket';
import { useFireSim } from './hooks/useFireSim';
import { Role, ScenarioState, Zone } from './types';
import type { MapLayout } from './types/firemap';

type Screen = 'lobby' | 'session';

export default function App() {
  const { socketRef, connected } = useSocket();
  const [screen, setScreen] = useState<Screen>('lobby');
  const [activeRole, setActiveRole] = useState<Role>('instructor');

  // --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ СЦЕНАРИЯ ---
  const [scenario, setScenario] = useState<ScenarioState>({
    temperature: 20,
    windDirection: 90,
    windSpeed: 5,
    timeOfDay: '12:00',
    waterSupplyWorking: true,
    northDirection: 0,
    incidentLocation: null,
    simulationStarted: false,
    triggerType: 'call',
    callerDifficulty: 'level1', // Обновлено
  });

  // Состояние карты и зон
  const [zones, setZones] = useState<Zone[]>([]);

  // Состояние ресурсов в депо (общие данные)
  const [stationResources, setStationResources] = useState<Record<string, number>>({});

  // Целевой адрес (задается руководителем, угадывается диспетчером)
  const [targetAddress, setTargetAddress] = useState<string>("");

  // Симуляция огня — подключаемся только когда симуляция запущена
  const fireSim = useFireSim(scenario.simulationStarted ? 'default' : null);

  // Карта, отправленная начальником штаба → РТП
  const [sharedMapLayout, setSharedMapLayout] = useState<MapLayout | null>(null);

  const handleEnterSession = (_gameId: string) => {
    setScreen('session');
  };

  // ── Лобби ──────────────────────────────────────────────────────────────────
  if (screen === 'lobby') {
    return (
      <div className="h-screen bg-slate-50">
        <LobbyScreen
          onCreateGame={handleEnterSession}
          onOpenGame={handleEnterSession}
        />
      </div>
    );
  }

  // ── Сессия ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Шапка */}
      <header className="bg-white border-b border-slate-200 shadow-sm z-30">
        <div className="max-w-full mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            <Tab role="instructor" label="Руководитель занятий" active={activeRole === 'instructor'} onClick={() => setActiveRole('instructor')} />
            <Tab role="dispatcher" label="Диспетчер" active={activeRole === 'dispatcher'} onClick={() => setActiveRole('dispatcher')} />
            <Tab role="rtp" label="РТП" active={activeRole === 'rtp'} onClick={() => setActiveRole('rtp')} />
            <Tab role="squad" label="Боевой расчет" active={activeRole === 'squad'} onClick={() => setActiveRole('squad')} />
            <Tab role="chief" label="Начальник штаба" active={activeRole === 'chief'} onClick={() => setActiveRole('chief')} />
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex-1 overflow-hidden relative">
        {activeRole === 'instructor' && (
          <InstructorView
            scenario={scenario}
            setScenario={setScenario}
            zones={zones}
            setZones={setZones}
            stationResources={stationResources}
            setStationResources={setStationResources}
            targetAddress={targetAddress}
            setTargetAddress={setTargetAddress}
            fireSim={fireSim}
            onBack={() => setScreen('lobby')}
          />
        )}
        {activeRole === 'dispatcher' && (
          <DispatcherView 
            scenario={scenario}
            stationResources={stationResources}
            correctAddress={targetAddress}
          />
        )}
        {activeRole === 'rtp' && <RTPView sharedLayout={sharedMapLayout} />}
        {activeRole === 'squad' && <SquadView />}
        {activeRole === 'chief' && <ChiefView simState={fireSim.simState} onShareLayout={setSharedMapLayout} />}
      </main>

      {/* Панель связи */}
      <CommunicationPanel role={activeRole} socketRef={socketRef} connected={connected} />
    </div>
  );
}

function Tab({ label, active, onClick }: { role: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
        active 
          ? 'border-blue-600 text-blue-700 bg-blue-50' 
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}