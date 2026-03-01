import React, { useEffect, useState } from 'react';
import { Truck, PhoneCall, Radio, PhoneOff, Mic, Navigation, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useYandexMap, type MapMarker } from '../hooks/useYandexMap';
import { ScenarioState } from '../types';
import { useGame, type VehicleType } from '../hooks/useGame';

interface DispatcherViewProps {
  scenario: ScenarioState;
  stationResources: Record<string, number>; 
  correctAddress: string; 
}

const BASE_FAKE_ADDRESSES = [
    { coords: [43.4050, 39.9540], label: "Олимпийский пр., 12" },
    { coords: [43.4070, 39.9570], label: "ул. Триумфальная, 4" },
    { coords: [43.4030, 39.9510], label: "Морской бульвар, 1" },
    { coords: [43.4090, 39.9590], label: "ул. Чемпионов, 8" },
];

export default function DispatcherView({ scenario, stationResources, correctAddress }: DispatcherViewProps) {
  const [callStatus, setCallStatus] = useState<'idle' | 'incoming' | 'active' | 'ended'>('idle');
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [dispatchedVehicles, setDispatchedVehicles] = useState<Record<string, number>>({});
  const [isCalculated, setIsCalculated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);

  const game = useGame();
  useEffect(() => { game.loadVehicleTypes().then(setVehicleTypes); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mapPoints = React.useMemo(() => {
      const correctPoint = { coords: [43.4060, 39.9560], label: correctAddress || "Неизвестный адрес" };
      return [...BASE_FAKE_ADDRESSES, correctPoint].sort(() => Math.random() - 0.5);
  }, [correctAddress]);

  const mapMarkers: MapMarker[] = React.useMemo(() => {
      if (!scenario.simulationStarted) return [];
      return mapPoints.map(p => ({
          coords: p.coords,
          label: p.label,
          selected: selectedAddress === p.label,
      }));
  }, [scenario.simulationStarted, mapPoints, selectedAddress]);

  const handleMarkerClick = React.useCallback((label: string) => {
      if (!isCalculated) setSelectedAddress(label);
  }, [isCalculated]);

  const { containerRef: mapContainerRef } = useYandexMap({
      apikey: import.meta.env.VITE_YANDEX_MAPS_KEY || '',
      center: [43.4056, 39.9550],
      zoom: 14,
      markers: mapMarkers,
      onMarkerClick: handleMarkerClick,
  });

  useEffect(() => {
    // Симуляция звонка через 3 секунды после старта
    if (scenario.simulationStarted && callStatus === 'idle') {
        const timer = setTimeout(() => setCallStatus('incoming'), 3000);
        return () => clearTimeout(timer);
    }
  }, [scenario.simulationStarted, callStatus]);

  const adjustDispatch = (id: string, delta: number) => {
    if (isCalculated) return;
    const current = dispatchedVehicles[id] || 0;
    const max = stationResources[id] || 0;
    const newValue = Math.min(Math.max(0, current + delta), max);
    setDispatchedVehicles(prev => ({ ...prev, [id]: newValue }));
  };

  const handleSendCalculation = () => {
    setErrorMsg(null);
    if (!selectedAddress) {
        setErrorMsg("Необходимо выбрать место вызова на карте!");
        return;
    }
    if (selectedAddress !== correctAddress) {
        setErrorMsg("ОШИБКА: Выбран неверный адрес! Уточните данные у заявителя.");
        return;
    }
    const totalVehicles = Object.values(dispatchedVehicles).reduce((a, b) => a + b, 0);
    if (totalVehicles === 0) {
        setErrorMsg("Не назначено ни одной машины!");
        return;
    }
    setIsCalculated(true);
    setCallStatus('ended');
  };

  return (
    <div className="flex h-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* ЛЕВАЯ ПАНЕЛЬ: ТЕЛЕФОНИЯ */}
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col z-20 shadow-xl relative shrink-0">
        <div className="p-5 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3">
            <PhoneCall className="w-5 h-5 text-emerald-600" />
            Линия 112
          </h2>
        </div>

        <div className="flex-1 flex flex-col p-6 relative overflow-hidden">
            {callStatus === 'active' && (
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                    <div className="w-64 h-64 bg-emerald-500 rounded-full animate-ping"></div>
                </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center space-y-6 z-10">
                {callStatus === 'idle' && (
                    <div className="text-slate-400 flex flex-col items-center animate-pulse">
                        <Radio className="w-16 h-16 mb-4" />
                        <span className="font-bold tracking-widest">ОЖИДАНИЕ ВЫЗОВА...</span>
                    </div>
                )}

                {callStatus === 'incoming' && (
                    <div className="flex flex-col items-center w-full animate-bounce-slow">
                        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center border-2 border-red-500 mb-6 shadow-xl">
                            <PhoneCall className="w-10 h-10 text-red-600 animate-shake" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">ВХОДЯЩИЙ ЗВОНОК</h3>
                        <button onClick={() => setCallStatus('active')} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                            <PhoneCall className="w-5 h-5" /> ОТВЕТИТЬ
                        </button>
                    </div>
                )}

                {callStatus === 'active' && (
                    <div className="flex flex-col items-center w-full h-full">
                        <div className="flex items-center gap-4 mb-auto w-full bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center">
                                <Mic className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                                <div className="text-xs text-slate-400 font-bold uppercase">Абонент</div>
                                <div className="text-slate-800 font-bold">Пострадавший (AI)</div>
                                <div className="text-[10px] text-red-500 animate-pulse mt-1 font-bold">● ЗАПИСЬ</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 h-16 my-8">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="w-2 bg-emerald-400 rounded-full animate-wave" style={{ height: `${Math.random() * 100}%`, animationDuration: `${0.5 + Math.random()}s` }}></div>
                            ))}
                        </div>

                        <div className="mt-auto w-full space-y-3">
                            <div className="p-3 bg-blue-50 rounded border border-blue-100 text-xs text-blue-900">
                                <span className="text-blue-600 font-bold block mb-1">ЗАДАЧА:</span>
                                Выясните точный адрес, количество людей и этаж.
                            </div>
                            <button onClick={() => setCallStatus('ended')} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2">
                                <PhoneOff className="w-5 h-5" /> ЗАВЕРШИТЬ
                            </button>
                        </div>
                    </div>
                )}

                {callStatus === 'ended' && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-600">ЗВОНОК ЗАВЕРШЕН</h3>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ: КАРТА И РАСЧЕТ */}
      <div className="flex-1 flex flex-col relative bg-white">
        <div className="flex-1 relative border-b border-slate-200">
             <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            
            {selectedAddress && (
                <div className="absolute top-4 left-4 bg-white/90 p-4 rounded-xl border border-slate-200 backdrop-blur shadow-xl z-10">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Выбран адрес</div>
                    <div className="text-lg text-slate-900 font-bold flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-red-600" />
                        {selectedAddress}
                    </div>
                </div>
            )}

            {errorMsg && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white p-6 rounded-2xl shadow-2xl backdrop-blur flex flex-col items-center animate-bounce-slow z-50">
                    <AlertTriangle className="w-12 h-12 mb-2" />
                    <span className="font-bold text-center">{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="mt-4 px-4 py-2 bg-white/20 rounded hover:bg-white/30 text-xs font-bold uppercase">Закрыть</button>
                </div>
            )}
        </div>

        <div className="h-80 bg-white p-4 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20 border-t border-slate-200">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2"><Truck className="w-5 h-5 text-blue-600" /> Формирование Расчета</h3>
                <div className="text-xs text-slate-500">Всего в депо: <span className="text-slate-800 font-bold">{Object.values(stationResources).reduce((a,b)=>a+b, 0)} ед.</span></div>
            </div>

            <div className="flex-1 overflow-y-auto mb-3 pr-2 grid grid-cols-2 gap-2">
                {vehicleTypes.map(v => {
                    const available = stationResources[v.key] || 0;
                    const selected = dispatchedVehicles[v.key] || 0;
                    return (
                        <div key={v.key} className={`flex items-center justify-between p-2 rounded border transition-all ${selected > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'} ${available === 0 ? 'opacity-40 pointer-events-none bg-slate-50' : ''}`}>
                            <div className="min-w-0 pr-2">
                                <div className="text-xs font-bold text-slate-800 truncate" title={v.name}>{v.name}</div>
                                <div className="text-[10px] text-slate-500">В резерве: {available}</div>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 rounded px-1 py-0.5 border border-slate-200 shrink-0">
                                <button onClick={() => adjustDispatch(v.key, -1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-blue-600">-</button>
                                <span className={`text-sm font-bold w-4 text-center ${selected > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{selected}</span>
                                <button onClick={() => adjustDispatch(v.key, 1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-blue-600">+</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <button onClick={handleSendCalculation} disabled={isCalculated} className={`w-full py-3 rounded-xl font-bold text-sm tracking-widest transition-all shadow-md flex items-center justify-center gap-3 ${isCalculated ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-200'}`}>
                {isCalculated ? <><CheckCircle2 className="w-5 h-5" /> РАСЧЕТ ОТПРАВЛЕН</> : <><Navigation className="w-5 h-5" /> ОТПРАВИТЬ СИЛЫ И СРЕДСТВА</>}
            </button>
        </div>
      </div>
    </div>
  );
}