import { Map as MapIcon, Truck, PhoneCall } from 'lucide-react';
import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps';
import { ScenarioState } from '../types';

interface DispatcherViewProps {
  scenario: ScenarioState;
}

export default function DispatcherView({ scenario }: DispatcherViewProps) {
  return (
    <div className="flex h-full bg-slate-100">
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-emerald-600" />
            Поступающие вызовы
          </h2>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          {scenario.simulationStarted ? (
            scenario.triggerType === 'sensor' ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3 animate-pulse">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Система АПС</span>
                  <span className="text-xs text-slate-500">Сейчас</span>
                </div>
                <p className="text-sm text-slate-800 font-medium">Срабатывание пожарной сигнализации</p>
                {scenario.incidentLocation && (
                  <p className="text-xs text-slate-600 mt-1">
                    Координаты: {scenario.incidentLocation[0].toFixed(4)}, {scenario.incidentLocation[1].toFixed(4)}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3 animate-pulse">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Входящий звонок (112)</span>
                  <span className="text-xs text-slate-500">Ожидание ответа...</span>
                </div>
                <p className="text-sm text-slate-800 font-medium">Абонент на линии</p>
                <button className="mt-2 w-full py-1.5 bg-amber-500 text-white text-xs font-medium rounded hover:bg-amber-600">
                  Принять вызов
                </button>
              </div>
            )
          ) : (
            <div className="text-sm text-slate-500 text-center mt-10">Нет активных вызовов</div>
          )}
        </div>
        <div className="p-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Управление силами</h3>
          <button className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Truck className="w-4 h-4" />
            Отправить расчет
          </button>
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex items-center justify-center relative overflow-hidden">
          <YMaps>
            <Map 
              defaultState={{ center: [43.4056, 39.9550], zoom: 13 }} 
              width="100%" 
              height="100%"
            >
              {scenario.simulationStarted && scenario.triggerType === 'sensor' && scenario.incidentLocation && (
                <Placemark geometry={scenario.incidentLocation} options={{ preset: 'islands#redFireIcon' }} />
              )}
            </Map>
          </YMaps>
          
          {!scenario.simulationStarted && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="bg-white/90 p-6 rounded-2xl shadow-lg backdrop-blur-sm text-center">
                <MapIcon className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold text-slate-800">Карта Сириуса</h2>
                <p className="text-slate-500 mt-2 max-w-md mx-auto">Ожидание поступления вызовов...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
