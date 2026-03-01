import { useState, useEffect } from 'react';
import InstructorView from './components/InstructorView';
import DispatcherView from './components/DispatcherView';
import RTPView from './components/RTPView';
import SquadView from './components/SquadView';
import ChiefView from './components/ChiefView';
import CommunicationPanel from './components/CommunicationPanel';
import LobbyScreen from './components/LobbyScreen';
import StudentLobby from './components/StudentLobby';
import { useSocket } from './hooks/useSocket';
import { useFireSim } from './hooks/useFireSim';
import { useGame } from './hooks/useGame';
import { ScenarioState, Zone } from './types';
import type { MapLayout } from './types/firemap';
import { LogIn, LogOut, Lock } from 'lucide-react';

type Screen = 'lobby' | 'session';
type UserMode = 'student' | 'teacher';
type StudentRole = 'dispatcher' | 'rtp' | 'squad' | 'chief';

export default function App() {
  const { socketRef, connected } = useSocket();
  const game = useGame();

  // Auth state
  const [userMode, setUserMode] = useState<UserMode>(() =>
    localStorage.getItem('mchs_teacher') === '1' ? 'teacher' : 'student'
  );
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Teacher flow
  const [screen, setScreen] = useState<Screen>('lobby');

  // Student flow
  const [studentRole, setStudentRole] = useState<StudentRole | null>(null);

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
    callerDifficulty: 'level1',
  });

  const [zones, setZones] = useState<Zone[]>([]);
  const [stationResources, setStationResources] = useState<Record<string, number>>({});
  const [targetAddress, setTargetAddress] = useState<string>('');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const fireSim = useFireSim(scenario.simulationStarted ? activeGameId : null);
  const [sharedMapLayout, setSharedMapLayout] = useState<MapLayout | null>(null);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const ok = await game.login(loginPassword);
    if (ok) {
      setUserMode('teacher');
      localStorage.setItem('mchs_teacher', '1');
      setShowLoginModal(false);
      setLoginPassword('');
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    setUserMode('student');
    localStorage.removeItem('mchs_teacher');
    setScreen('lobby');
  };

  // ── Student role handlers ──────────────────────────────────────────────────
  const handleJoinRole = (role: string) => {
    setStudentRole(role as StudentRole);
  };

  const handleLeaveRole = () => {
    if (studentRole) {
      game.leaveRole(studentRole);
    }
    setStudentRole(null);
  };

  // Release role on page close (backup for SocketIO disconnect)
  useEffect(() => {
    const release = () => {
      if (studentRole) {
        const url = `${import.meta.env.VITE_API_BASE ?? 'http://localhost:5000'}/game/roles/leave`;
        const blob = new Blob([JSON.stringify({ role: studentRole })], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      }
    };
    window.addEventListener('beforeunload', release);
    return () => window.removeEventListener('beforeunload', release);
  }, [studentRole]);

  // Fetch active game id + running state on mount
  useEffect(() => {
    game.getStatus().then((st) => {
      setActiveGameId(st.active_game_id);
      if (st.is_running) {
        setScenario((prev) => ({ ...prev, simulationStarted: true }));
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnterSession = (_gameId: string) => {
    setActiveGameId(_gameId);
    setScreen('session');
  };

  // ── Login modal ────────────────────────────────────────────────────────────
  const loginModal = showLoginModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">Вход для руководителя</h2>
        </div>
        <input
          type="password"
          value={loginPassword}
          onChange={(e) => { setLoginPassword(e.target.value); setLoginError(false); }}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="Пароль"
          autoFocus
          className={`w-full px-3 py-2 border rounded-lg text-sm mb-3 outline-none transition-colors ${
            loginError ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-blue-400'
          }`}
        />
        {loginError && <p className="text-xs text-red-500 mb-3">Неверный пароль</p>}
        <div className="flex gap-2">
          <button
            onClick={() => { setShowLoginModal(false); setLoginPassword(''); setLoginError(false); }}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            onClick={handleLogin}
            className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
          >
            Войти
          </button>
        </div>
      </div>
    </div>
  );

  // ── Auth button (top-right corner) ─────────────────────────────────────────
  const authButton = (
    <div className="fixed top-3 right-4 z-40">
      {userMode === 'student' ? (
        <button
          onClick={() => setShowLoginModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 text-xs font-medium transition-all shadow-sm"
        >
          <LogIn className="w-3.5 h-3.5" /> Руководитель
        </button>
      ) : (
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-all shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" /> Выйти
        </button>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // STUDENT MODE
  // ══════════════════════════════════════════════════════════════════════════
  if (userMode === 'student') {
    // Student is in a role → show role-specific view
    if (studentRole) {
      return (
        <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
          <header className="bg-white border-b border-slate-200 shadow-sm z-30 flex items-center justify-between px-4 h-12">
            <span className="text-sm font-bold text-slate-700">
              {studentRole === 'dispatcher' && '📞 Диспетчер'}
              {studentRole === 'rtp' && '🛡️ РТП'}
              {studentRole === 'squad' && '👷 Боевой участок'}
              {studentRole === 'chief' && '📋 Начальник штаба'}
            </span>
            <button
              onClick={handleLeaveRole}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-xs font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Выйти из роли
            </button>
          </header>
          <main className="flex-1 overflow-hidden relative">
            {studentRole === 'dispatcher' && (
              <DispatcherView
                scenario={scenario}
                stationResources={stationResources}
                correctAddress={targetAddress}
              />
            )}
            {studentRole === 'rtp' && <RTPView sharedLayout={sharedMapLayout} />}
            {studentRole === 'squad' && <SquadView simState={fireSim.simState} fireSim={fireSim} />}
            {studentRole === 'chief' && <ChiefView simState={fireSim.simState} fireSim={fireSim} onShareLayout={setSharedMapLayout} />}
          </main>
          <CommunicationPanel role={studentRole} socketRef={socketRef} connected={connected} />
        </div>
      );
    }

    // Student lobby (role selection or "no games")
    return (
      <>
        {authButton}
        {loginModal}
        <StudentLobby
          socketId={socketRef.current?.id ?? null}
          onJoin={handleJoinRole}
        />
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TEACHER MODE
  // ══════════════════════════════════════════════════════════════════════════

  // Teacher lobby
  if (screen === 'lobby') {
    return (
      <div className="h-screen bg-slate-50">
        {authButton}
        {loginModal}
        <LobbyScreen
          onCreateGame={handleEnterSession}
          onOpenGame={handleEnterSession}
        />
      </div>
    );
  }

  // Teacher session (InstructorView only, no tabs)
  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {authButton}
      <main className="flex-1 overflow-hidden relative">
        <InstructorView
          scenario={scenario}
          setScenario={setScenario}
          zones={zones}
          setZones={setZones}
          stationResources={stationResources}
          setStationResources={setStationResources}
          targetAddress={targetAddress}
          setTargetAddress={setTargetAddress}
          simState={fireSim.simState}
          fireSim={fireSim}
          onBack={() => setScreen('lobby')}
        />
      </main>
    </div>
  );
}
