import { useState, useEffect } from 'react';
import { Plus, Clock, Play, FileText } from 'lucide-react';
import { useGame, type GameInfo } from '../hooks/useGame';

interface LobbyScreenProps {
  onCreateGame: (gameId: string) => void;
  onOpenGame: (gameId: string) => void;
}

export default function LobbyScreen({ onCreateGame, onOpenGame }: LobbyScreenProps) {
  const game = useGame();
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  useEffect(() => {
    game.listGames().then(list => {
      setGames(list);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { game_id } = await game.createGame(newName.trim());
      onCreateGame(game_id);
    } catch (err) {
      console.error('Failed to create game:', err);
    } finally {
      setCreating(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Черновик';
      case 'running': return 'Идёт';
      case 'finished': return 'Завершена';
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-slate-100 text-slate-600';
      case 'running': return 'bg-green-100 text-green-700';
      case 'finished': return 'bg-blue-100 text-blue-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full bg-slate-50 p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Тренажёр МЧС</h1>
          <p className="text-sm text-slate-500 mt-2">Панель руководителя занятий</p>
        </div>

        {/* Создание новой тренировки */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          {!showNameInput ? (
            <button
              onClick={() => setShowNameInput(true)}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-lg border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all font-bold text-sm"
            >
              <Plus className="w-5 h-5" />
              Создать новую тренировку
            </button>
          ) : (
            <div className="flex gap-3">
              <input
                autoFocus
                type="text"
                placeholder="Название тренировки..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:border-blue-500 outline-none placeholder-slate-400"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-lg font-bold text-sm transition-colors shadow-sm"
              >
                {creating ? '...' : 'Создать'}
              </button>
              <button
                onClick={() => { setShowNameInput(false); setNewName(''); }}
                className="px-4 py-3 text-slate-500 hover:text-slate-700 text-sm"
              >
                Отмена
              </button>
            </div>
          )}
        </div>

        {/* Список игр */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4" /> Предыдущие тренировки
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Загрузка...</div>
          ) : games.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Нет созданных тренировок</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {games.map(g => (
                <div
                  key={g.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => onOpenGame(g.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">
                        {g.name || `Тренировка ${g.id}`}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {g.created_at ? new Date(g.created_at + 'Z').toLocaleString('ru-RU') : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${statusColor(g.status)}`}>
                      {statusLabel(g.status)}
                    </span>
                    <Play className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
