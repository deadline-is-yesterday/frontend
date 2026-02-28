import { Map as MapIcon, Users, Radio } from 'lucide-react';

export default function RTPView() {
  return (
    <div className="flex h-full bg-slate-100">
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Силы и средства
          </h2>
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">На позиции</h3>
            <div className="p-2 border border-slate-200 rounded-lg bg-slate-50 text-sm">
              <div className="font-medium text-slate-800">АЦ-3,2-40 (1 ПСЧ)</div>
              <div className="text-slate-500 text-xs mt-1">Развертывание магистральной линии</div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Связь</h3>
          <div className="grid grid-cols-2 gap-2">
            <button className="py-2 px-3 bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1">
              <Radio className="w-3 h-3" /> Диспетчер
            </button>
            <button className="py-2 px-3 bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1">
              <Radio className="w-3 h-3" /> Нач. штаба
            </button>
            <button className="py-2 px-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-100 col-span-2 flex items-center justify-center gap-1">
              <Radio className="w-3 h-3" /> Боевые участки
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/blueprint/1920/1080?blur=2')] bg-cover bg-center opacity-30"></div>
          <div className="relative z-10 text-center bg-white/90 p-6 rounded-2xl shadow-lg backdrop-blur-sm">
            <MapIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-800">Схема расстановки сил (План)</h2>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">Здесь РТП рисует план тушения со слов разведки. Эта карта не синхронизируется с реальной обстановкой автоматически.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
