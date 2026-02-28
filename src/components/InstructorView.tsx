import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, Map as MapIcon, Wind, Droplets, Clock, Thermometer, 
  Crosshair, Zap, Building, Square, 
  BrickWall, DoorOpen, Maximize, Droplet, 
  Undo, Redo, Magnet, CheckCircle, XCircle,
  Layers, Plus, Trash2, Play, FileCheck
} from 'lucide-react';
import { Zone, ZoneType, Point, ScenarioState } from '../types';
import CompassControl from './CompassControl';
import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps';

// --- ГЕОМЕТРИЧЕСКИЕ ХЕЛПЕРЫ ---
const getDistance = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const getClosestPointOnSegment = (p: Point, a: Point, b: Point) => {
  const atob = { x: b.x - a.x, y: b.y - a.y };
  const atop = { x: p.x - a.x, y: p.y - a.y };
  const len = atob.x * atob.x + atob.y * atob.y;
  if (len === 0) return a;
  let dot = atop.x * atob.x + atop.y * atob.y;
  const t = Math.min(1, Math.max(0, dot / len));
  return { x: a.x + atob.x * t, y: a.y + atob.y * t };
};

interface InstructorViewProps {
  scenario: ScenarioState;
  setScenario: (s: ScenarioState) => void;
  zones: Zone[];
  setZones: (z: Zone[]) => void;
}

export default function InstructorView({ scenario, setScenario, zones, setZones }: InstructorViewProps) {
  // --- STATE ---
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [currentTool, setCurrentTool] = useState<ZoneType | 'select' | 'scale'>('select');
  
  // Этажи
  const [currentFloor, setCurrentFloor] = useState<number>(1);
  const [floors, setFloors] = useState<number[]>([1]);

  // Рисование
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
  const [snappedPos, setSnappedPos] = useState<Point | null>(null); 
  
  // Настройки
  const [showGlobalMap, setShowGlobalMap] = useState(false);
  const [useEmptyCanvas, setUseEmptyCanvas] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);

  // История
  const [history, setHistory] = useState<Zone[][]>([zones]);
  const [historyStep, setHistoryStep] = useState(0);

  const svgRef = useRef<SVGSVGElement>(null);

  // --- УПРАВЛЕНИЕ ЭТАЖАМИ ---
  const addFloor = () => {
    const newFloor = floors[floors.length - 1] + 1;
    setFloors([...floors, newFloor]);
    setCurrentFloor(newFloor);
  };

  const deleteFloor = (floorId: number) => {
    if (floors.length === 1) return; // Нельзя удалить единственный этаж
    // Удаляем этаж из списка
    setFloors(floors.filter(f => f !== floorId));
    // Удаляем все зоны этого этажа
    const newZones = zones.filter(z => z.floor !== floorId);
    saveToHistory(newZones);
    // Переключаемся на первый этаж
    setCurrentFloor(floors[0]);
  };

  // --- ИСТОРИЯ ИЗМЕНЕНИЙ ---
  const saveToHistory = (newZones: Zone[]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newZones);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    setZones(newZones);
  };

  const handleGlobalUndo = useCallback(() => {
    if (draftPoints.length > 0) {
      setDraftPoints(prev => prev.slice(0, -1));
      return;
    }
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setZones(history[prevStep]);
    }
  }, [draftPoints, historyStep, history, setZones]);

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setZones(history[nextStep]);
    }
  };

  const finishCurrentShape = useCallback(() => {
    if (draftPoints.length < 2 && currentTool !== 'fire_origin') return;
    
    // Для стен и заборов не замыкаем, для зданий - замыкаем
    const shouldClose = ['building'].includes(currentTool as string);
    const points = shouldClose ? [...draftPoints, draftPoints[0]] : draftPoints;
    
    const newZone: Zone = { 
      id: Date.now().toString(), 
      type: currentTool as ZoneType, 
      points,
      floor: currentFloor // Привязываем к текущему этажу
    };
    
    saveToHistory([...zones, newZone]);
    setDraftPoints([]);
  }, [draftPoints, currentTool, zones, currentFloor]);

  const cancelDrawing = useCallback(() => {
    setDraftPoints([]);
  }, []);

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleGlobalUndo(); }
      if (e.key === 'Enter') { e.preventDefault(); finishCurrentShape(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelDrawing(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGlobalUndo, finishCurrentShape, cancelDrawing]);

  // --- ЛОГИКА "МАГНИТА" ---
  const calculateSnap = (mouseP: Point, isShiftHeld: boolean) => {
    if (!isSnappingEnabled && !isShiftHeld) return mouseP;
    let bestPoint = { ...mouseP };
    let minDist = 15; 

    if (isShiftHeld && draftPoints.length > 0) {
      const last = draftPoints[draftPoints.length - 1];
      const dx = Math.abs(mouseP.x - last.x);
      const dy = Math.abs(mouseP.y - last.y);
      if (dx > dy) bestPoint.y = last.y; else bestPoint.x = last.x;
    }

    if (isSnappingEnabled) {
      // Ищем точки только на ТЕКУЩЕМ этаже
      zones.filter(z => z.floor === currentFloor).forEach(z => {
        z.points.forEach(p => {
          const d = getDistance(bestPoint, p);
          if (d < minDist) { minDist = d; bestPoint = p; }
        });
        
        if (['door', 'window', 'wall'].includes(currentTool as string)) {
            if (z.type === 'wall' || z.type === 'building') {
                for (let i = 0; i < z.points.length - 1; i++) {
                    const closest = getClosestPointOnSegment(bestPoint, z.points[i], z.points[i+1]);
                    const d = getDistance(bestPoint, closest);
                    if (d < minDist) { minDist = d; bestPoint = closest; }
                }
            }
        }
      });
      if (draftPoints.length > 2) {
         if (getDistance(bestPoint, draftPoints[0]) < minDist) bestPoint = draftPoints[0];
      }
    }
    return bestPoint;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    setCursorPos({ x: rawX, y: rawY });
    setSnappedPos(calculateSnap({ x: rawX, y: rawY }, e.shiftKey));
  };

  const handleMapClick = (e: React.MouseEvent) => {
    if (currentTool === 'select' || !snappedPos) return;

    if (currentTool === 'fire_origin' || currentTool === 'water_source') {
      const newZone = { 
        id: Date.now().toString(), 
        type: currentTool, 
        points: [snappedPos],
        floor: currentFloor 
      };
      saveToHistory([...zones, newZone]);
      setCurrentTool('select');
      return;
    }
    // Замыкание фигуры
    if (draftPoints.length > 0 && draftPoints[0].x === snappedPos.x && draftPoints[0].y === snappedPos.y && draftPoints.length > 2) {
        finishCurrentShape();
    } else {
        setDraftPoints([...draftPoints, snappedPos]);
    }
  };

  // --- СПЕЦИАЛЬНЫЕ ФУНКЦИИ ---

  // Удалить картинку-подложку (Завершить схему)
  const finishSchema = () => {
    if (window.confirm('Вы уверены? Загруженная схема (картинка) будет удалена, останутся только нарисованные вами объекты.')) {
      setMapImage(null);
      setUseEmptyCanvas(true);
    }
  };

  // Запуск симуляции
  const startSimulation = async () => {
    if (!scenario.incidentLocation) {
        alert('Сначала выберите место инцидента на глобальной карте!');
        setShowGlobalMap(true);
        return;
    }
    
    // Здесь мы формируем пакет данных для старта
    const simulationData = {
        scenario: { ...scenario, simulationStarted: true },
        zones: zones,
        floors: floors
    };

    setScenario({ ...scenario, simulationStarted: true });
    
    // В реальном проекте здесь будет POST запрос
    console.log('Simulation Starting with data:', simulationData);
    
    await fetch('/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulationData)
    }).catch(err => console.error("Sim start fake error:", err)); // Игнорируем ошибку т.к. бэкенда нет
    
    alert('Симуляция запущена! Данные переданы.');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setMapImage(event.target?.result as string);
        setUseEmptyCanvas(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGlobalMapClick = (e: any) => {
    const coords = e.get('coords');
    setScenario({ ...scenario, incidentLocation: coords });
  };

  return (
    <div className="flex h-full select-none">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
        
        {/* Undo/Redo & Floor Control */}
        <div className="p-2 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
             <div className="flex justify-between items-center mb-2">
                 <div className="flex gap-1">
                   <button onClick={handleGlobalUndo} disabled={historyStep === 0 && draftPoints.length === 0} className="p-2 bg-white rounded border hover:bg-slate-100 disabled:opacity-50"><Undo className="w-4 h-4" /></button>
                   <button onClick={handleRedo} disabled={historyStep === history.length - 1} className="p-2 bg-white rounded border hover:bg-slate-100 disabled:opacity-50"><Redo className="w-4 h-4" /></button>
                 </div>
                 <button onClick={() => setIsSnappingEnabled(!isSnappingEnabled)} className={`p-2 rounded flex gap-2 text-xs font-bold ${isSnappingEnabled ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>
                    <Magnet className="w-4 h-4" /> {isSnappingEnabled ? 'ON' : 'OFF'}
                 </button>
             </div>
             
             {/* Управление этажами */}
             <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-500"/>
                    <span className="text-sm font-semibold">Этаж:</span>
                    <select 
                        value={currentFloor} 
                        onChange={(e) => setCurrentFloor(Number(e.target.value))}
                        className="text-sm border-none bg-transparent font-bold text-blue-600 cursor-pointer focus:ring-0"
                    >
                        {floors.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div className="flex gap-1">
                    <button onClick={addFloor} className="p-1 hover:bg-green-100 text-green-600 rounded" title="Добавить этаж"><Plus className="w-4 h-4"/></button>
                    <button onClick={() => deleteFloor(currentFloor)} className="p-1 hover:bg-red-100 text-red-600 rounded" title="Удалить этаж"><Trash2 className="w-4 h-4"/></button>
                </div>
             </div>
        </div>

        {/* Сценарий и Действия */}
        <div className="p-4 border-b border-slate-200 space-y-3">
           <button onClick={() => setShowGlobalMap(!showGlobalMap)} className="w-full py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm hover:bg-slate-200 flex items-center justify-center gap-2">
              <MapIcon className="w-4 h-4"/> {showGlobalMap ? 'Вернуться к схеме' : 'Глобальная карта'}
           </button>
           
           {!showGlobalMap && mapImage && (
               <button onClick={finishSchema} className="w-full py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-sm hover:bg-amber-200 flex items-center justify-center gap-2">
                  <FileCheck className="w-4 h-4"/> Завершить схему
               </button>
           )}

           <button onClick={startSimulation} className="w-full py-3 bg-indigo-600 text-white shadow-lg rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center justify-center gap-2">
              <Play className="w-4 h-4 fill-current"/> НАЧАТЬ СИМУЛЯЦИЮ
           </button>
        </div>

        {/* Инструменты */}
        {!showGlobalMap && (
        <div className="p-4 border-b border-slate-200">
           {/* Загрузка, если нет изображения и не пустой холст */}
           {!mapImage && !useEmptyCanvas && (
             <label className="flex items-center justify-center w-full px-4 py-8 bg-slate-50 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-white mb-4">
                <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600">Загрузить план здания</span>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
             </label>
           )}

          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Конструкции</h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <ToolButton active={currentTool === 'wall'} onClick={() => setCurrentTool('wall')} icon={<BrickWall />} label="Стена" />
            <ToolButton active={currentTool === 'door'} onClick={() => setCurrentTool('door')} icon={<DoorOpen />} label="Дверь" />
            <ToolButton active={currentTool === 'window'} onClick={() => setCurrentTool('window')} icon={<Maximize />} label="Окно" />
            <ToolButton active={currentTool === 'fence'} onClick={() => setCurrentTool('fence')} icon={<Square />} label="Забор" />
            <ToolButton active={currentTool === 'building'} onClick={() => setCurrentTool('building')} icon={<Building />} label="Здание" />
          </div>

          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Обстановка</h2>
          <div className="grid grid-cols-2 gap-2">
            <ToolButton active={currentTool === 'fire_origin'} onClick={() => setCurrentTool('fire_origin')} icon={<Crosshair />} label="Очаг возгорания" />
            <ToolButton active={currentTool === 'water_source'} onClick={() => setCurrentTool('water_source')} icon={<Droplet />} label="Водоисточник" />
          </div>

          {/* Панель рисования */}
          {draftPoints.length > 0 && (
             <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-blue-800">Точек: {draftPoints.length}</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={finishCurrentShape} className="flex-1 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Готово (Enter)
                    </button>
                    <button onClick={cancelDrawing} className="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-medium rounded hover:bg-red-50 flex items-center justify-center gap-1">
                        <XCircle className="w-3 h-3" /> Сброс
                    </button>
                </div>
             </div>
          )}
        </div>
        )}

        {/* Настройки среды */}
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Сценарий</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Температура</label>
                  <div className="flex items-center border rounded px-2 py-1">
                      <Thermometer className="w-3 h-3 text-slate-400 mr-1"/>
                      <input type="number" value={scenario.temperature} onChange={e => setScenario({...scenario, temperature: Number(e.target.value)})} className="w-full text-sm outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase">Ветер (м/с)</label>
                  <div className="flex items-center border rounded px-2 py-1">
                      <Wind className="w-3 h-3 text-slate-400 mr-1"/>
                      <input type="number" value={scenario.windSpeed} onChange={e => setScenario({...scenario, windSpeed: Number(e.target.value)})} className="w-full text-sm outline-none" />
                  </div>
                </div>
            </div>
            <div className="flex gap-4 justify-around py-2">
              <CompassControl label="Ветер" value={scenario.windDirection} onChange={(val) => setScenario({...scenario, windDirection: val})} color="blue" />
              <CompassControl label="Север" value={scenario.northDirection} onChange={(val) => setScenario({...scenario, northDirection: val})} color="red" />
            </div>
          </div>
        </div>

        {/* Вводные */}
        <div className="p-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Вводные
          </h2>
          <div className="space-y-2">
            <EventButton label="Отказ техники" />
            <EventButton label="Изменение ветра" />
            <EventButton label="Обрушение конструкции" />
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 bg-slate-200 relative overflow-auto flex items-center justify-center">
        {showGlobalMap ? (
           <div className="w-full h-full relative">
             <YMaps>
               <Map defaultState={{ center: [43.4056, 39.9550], zoom: 13 }} width="100%" height="100%" onClick={handleGlobalMapClick}>
                 {scenario.incidentLocation && <Placemark geometry={scenario.incidentLocation} options={{ preset: 'islands#redFireIcon' }} />}
               </Map>
             </YMaps>
             {scenario.incidentLocation && (
                 <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-md z-10">
                   <p className="text-sm font-medium">Координаты: {scenario.incidentLocation[0].toFixed(4)}, {scenario.incidentLocation[1].toFixed(4)}</p>
                 </div>
             )}
           </div>
        ) : (mapImage || useEmptyCanvas) ? (
          <div 
            className="relative bg-white shadow-2xl cursor-crosshair m-8 border border-slate-300"
            style={useEmptyCanvas ? { width: 1000, height: 800 } : {}}
            onMouseMove={handleMouseMove}
            onClick={handleMapClick}
            onContextMenu={(e) => { e.preventDefault(); finishCurrentShape(); }} 
          >
            {/* ПОДЛОЖКА (Изображение) */}
            {mapImage && <img src={mapImage} alt="Map" className="max-w-none pointer-events-none select-none opacity-50 hover:opacity-100 transition-opacity" />}
            
            <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {useEmptyCanvas && !mapImage && <rect width="100%" height="100%" fill="#ffffff" />}
              
              {/* Рендеринг только зон ТЕКУЩЕГО этажа */}
              {zones.filter(z => z.floor === currentFloor).map(zone => <ZoneRenderer key={zone.id} zone={zone} />)}

              {/* Драфт (рисование) */}
              {draftPoints.length > 0 && (
                <>
                  <polyline points={draftPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="2" />
                  {snappedPos && (
                      <line x1={draftPoints[draftPoints.length-1].x} y1={draftPoints[draftPoints.length-1].y} x2={snappedPos.x} y2={snappedPos.y} stroke="#2563eb" strokeWidth="1" strokeDasharray="4 4" opacity="0.6"/>
                  )}
                  {draftPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#2563eb" strokeWidth="1.5" />)}
                </>
              )}

              {/* Курсор */}
              {snappedPos && currentTool !== 'select' && (
                  <g transform={`translate(${snappedPos.x}, ${snappedPos.y})`}>
                      <circle r="4" fill="none" stroke="#ef4444" strokeWidth="2" />
                  </g>
              )}
            </svg>

            {/* Индикатор этажа на карте */}
            <div className="absolute top-4 left-4 bg-white/90 px-3 py-1 rounded shadow text-xs font-bold text-slate-600 pointer-events-none">
                ЭТАЖ {currentFloor}
            </div>

            {/* Компасы */}
            <div className="absolute top-4 right-4 w-12 h-12 bg-white/80 rounded-full shadow flex items-center justify-center pointer-events-none">
              <div style={{ transform: `rotate(${scenario.northDirection}deg)` }} className="text-red-500 font-bold flex flex-col items-center">
                <span className="text-[10px] leading-none">С</span><div className="w-1 h-4 bg-red-500"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
             <div className="p-8 bg-slate-100 rounded-xl border border-slate-300">
                <p className="text-slate-500 mb-4">Загрузите схему в меню слева или начните с пустого</p>
                <button onClick={() => setUseEmptyCanvas(true)} className="px-6 py-3 bg-white shadow rounded-lg font-medium text-slate-700 hover:text-blue-600">
                   Начать с чистого листа
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- КОМПОНЕНТЫ UI ---

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${active ? 'bg-blue-600 border-blue-600 text-white shadow-md transform scale-105' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
      <div className="mb-1 transform scale-75">{icon}</div>
      <span className="text-[10px] font-bold text-center leading-none">{label}</span>
    </button>
  );
}

function EventButton({ label }: { label: string }) {
  return <button className="w-full text-left px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-amber-50 transition-colors">{label}</button>;
}

function ZoneRenderer({ zone }: { zone: Zone }) {
  const pointsStr = zone.points.map(p => `${p.x},${p.y}`).join(' ');

  if (zone.type === 'fire_origin') return <circle cx={zone.points[0].x} cy={zone.points[0].y} r="8" fill="#ef4444" stroke="#fff" strokeWidth="2"><animate attributeName="r" values="8;10;8" dur="1.5s" repeatCount="indefinite" /></circle>;
  if (zone.type === 'water_source') return <circle cx={zone.points[0].x} cy={zone.points[0].y} r="6" fill="#3b82f6" stroke="#fff" strokeWidth="2" />;
  
  if (zone.type === 'wall') return <polyline points={pointsStr} fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="square" />;
  if (zone.type === 'door') return <polyline points={pointsStr} fill="none" stroke="#78350f" strokeWidth="6" strokeDasharray="10,5" />;
  if (zone.type === 'window') return <polyline points={pointsStr} fill="none" stroke="#0ea5e9" strokeWidth="4" />;
  if (zone.type === 'fence') return <polyline points={pointsStr} fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="4 2" />;
  if (zone.type === 'building') return <polygon points={pointsStr} fill="rgba(203, 213, 225, 0.5)" stroke="#475569" strokeWidth="1" />;

  return null;
}