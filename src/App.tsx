import { useState } from 'react';
import InstructorView from './components/InstructorView';
import DispatcherView from './components/DispatcherView';
import RTPView from './components/RTPView';
import SquadView from './components/SquadView';
import ChiefView from './components/ChiefView';
import CommunicationPanel from './components/CommunicationPanel';
import { Role, ScenarioState, Zone } from './types';

export default function App() {
  const [activeRole, setActiveRole] = useState<Role>('instructor');

  // Global State
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
  });
  const [zones, setZones] = useState<Zone[]>([]);

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 font-sans">
      {/* Header / Tabs */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            <Tab role="instructor" label="Руководитель занятий" active={activeRole === 'instructor'} onClick={() => setActiveRole('instructor')} />
            <Tab role="dispatcher" label="Диспетчер" active={activeRole === 'dispatcher'} onClick={() => setActiveRole('dispatcher')} />
            <Tab role="rtp" label="РТП" active={activeRole === 'rtp'} onClick={() => setActiveRole('rtp')} />
            <Tab role="squad" label="Боевой расчет" active={activeRole === 'squad'} onClick={() => setActiveRole('squad')} />
            <Tab role="chief" label="Начальник штаба" active={activeRole === 'chief'} onClick={() => setActiveRole('chief')} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeRole === 'instructor' && <InstructorView scenario={scenario} setScenario={setScenario} zones={zones} setZones={setZones} />}
        {activeRole === 'dispatcher' && <DispatcherView scenario={scenario} />}
        {activeRole === 'rtp' && <RTPView />}
        {activeRole === 'squad' && <SquadView />}
        {activeRole === 'chief' && <ChiefView />}
      </main>

      {/* Communication Panel */}
      <CommunicationPanel role={activeRole} />
    </div>
  );
}

function Tab({ label, active, onClick }: { role: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
        active ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
      }`}
    >
      {label}
    </button>
  );
}
