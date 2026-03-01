import { useEffect, useState } from 'react';
import { Radio, Shield, Users, Truck, RefreshCw, LogIn } from 'lucide-react';
import { useGame, type RoleInfo } from '../hooks/useGame';

const ROLE_META: Record<string, { label: string; icon: typeof Radio; color: string }> = {
  dispatcher: { label: 'Диспетчер',        icon: Radio,  color: 'blue' },
  rtp:        { label: 'РТП',              icon: Shield, color: 'red' },
  squad:      { label: 'Боевой расчёт',    icon: Users,  color: 'amber' },
  chief:      { label: 'Начальник штаба',  icon: Truck,  color: 'emerald' },
};

interface StudentLobbyProps {
  socketId: string | null;
  onJoin: (role: string) => void;
}

export default function StudentLobby({ socketId, onJoin }: StudentLobbyProps) {
  const game = useGame();
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = async () => {
    setLoading(true);
    const data = await game.getRoles();
    setRunning(data.running);
    setRoles(data.roles);
    setLoading(false);
  };

  useEffect(() => {
    fetchRoles();
    const interval = setInterval(fetchRoles, 5000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = async (role: string) => {
    if (!socketId) {
      setError('Нет подключения к серверу');
      return;
    }
    setJoining(role);
    setError(null);
    const ok = await game.joinRole(role, socketId);
    if (ok) {
      onJoin(role);
    } else {
      setError('Роль уже занята. Попробуйте другую.');
      await fetchRoles();
    }
    setJoining(null);
  };

  // ── Заглушка: игра не запущена ──────────────────────────────────────────
  if (!loading && !running) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
        <div className="text-6xl mb-6">🔥</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Нет активных занятий</h1>
        <p className="text-sm text-slate-500 mb-8">Ожидайте, пока руководитель запустит учебную тревогу</p>
        <button
          onClick={fetchRoles}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Обновить
        </button>
      </div>
    );
  }

  // ── Выбор роли ────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="text-4xl mb-4">🚒</div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Учебная тревога</h1>
      <p className="text-sm text-slate-500 mb-8">Выберите свою роль</p>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 max-w-md w-full px-4">
        {roles.map((r) => {
          const meta = ROLE_META[r.role];
          if (!meta) return null;
          const Icon = meta.icon;
          const isBusy = r.occupied;
          const isJoining = joining === r.role;

          return (
            <button
              key={r.role}
              disabled={isBusy || isJoining || !socketId}
              onClick={() => handleJoin(r.role)}
              className={`
                flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all
                ${isBusy
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  : `border-${meta.color}-200 bg-white hover:border-${meta.color}-400 hover:shadow-lg text-slate-700 cursor-pointer`
                }
              `}
            >
              <Icon className={`w-8 h-8 ${isBusy ? 'text-slate-300' : `text-${meta.color}-500`}`} />
              <span className="text-sm font-bold">{meta.label}</span>
              {isBusy ? (
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Занято</span>
              ) : isJoining ? (
                <span className="text-[10px] text-blue-500 uppercase tracking-wider">Подключение...</span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-green-500 uppercase tracking-wider">
                  <LogIn className="w-3 h-3" /> Доступно
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="mt-6 text-xs text-slate-400">Загрузка...</div>
      )}
    </div>
  );
}
