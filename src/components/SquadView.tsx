import { Flame, Droplets, Navigation } from 'lucide-react';

export default function SquadView() {
  return (
    <div className="flex h-full bg-slate-100">
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-red-50">
          <h2 className="text-lg font-semibold text-red-800 flex items-center gap-2">
            <Flame className="w-5 h-5 text-red-600" />
            Боевой участок
          </h2>
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Состояние техники</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700 flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-500"/> Вода (АЦ-3,2)</span>
                  <span className="font-medium">2.1 т / 3.2 т</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700">Рукава (51 мм)</span>
                  <span className="font-medium">4 / 10 шт</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div className="bg-slate-600 h-1.5 rounded-full" style={{ width: '40%' }}></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Действия</h3>
            <div className="space-y-2">
              <button className="w-full py-2 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50">Проложить линию</button>
              <button className="w-full py-2 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50">Подать ствол</button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/fire/1920/1080?blur=1')] bg-cover bg-center opacity-40"></div>
          <div className="relative z-10 text-center bg-white/90 p-6 rounded-2xl shadow-lg backdrop-blur-sm">
            <Navigation className="w-12 h-12 text-red-600 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-800">Реальная обстановка</h2>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">Здесь отображается фактическая карта пожара. Боевой расчет видит реальное распространение огня и должен докладывать РТП.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
