import React, { useState } from 'react';
import { Upload, Map as MapIcon, Flame, Wind, Droplets, Clock, Thermometer, Crosshair, CloudFog, Zap, Building, Square, Mountain } from 'lucide-react';
import { Zone, ZoneType, Point, ScenarioState } from '../types';
import CompassControl from './CompassControl';
import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps';

interface InstructorViewProps {
  scenario: ScenarioState;
  setScenario: (s: ScenarioState) => void;
  zones: Zone[];
  setZones: (z: Zone[]) => void;
}

export default function InstructorView({ scenario, setScenario, zones, setZones }: InstructorViewProps) {
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1); // meters per pixel
  const [currentTool, setCurrentTool] = useState<ZoneType | 'select' | 'scale'>('select');
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [showGlobalMap, setShowGlobalMap] = useState(false);
  const [useEmptyCanvas, setUseEmptyCanvas] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);

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

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentTool === 'select' || currentTool === 'scale') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'fire_origin') {
      setZones([...zones, { id: Date.now().toString(), type: 'fire_origin', points: [{ x, y }] }]);
      setCurrentTool('select');
    } else {
      // Polygon drawing
      setDrawingPoints([...drawingPoints, { x, y }]);
    }
  };

  const finishPolygon = () => {
    if (drawingPoints.length > 2) {
      setZones([...zones, { id: Date.now().toString(), type: currentTool as ZoneType, points: drawingPoints }]);
    }
    setDrawingPoints([]);
    setCurrentTool('select');
  };

  const handleGlobalMapClick = (e: any) => {
    const coords = e.get('coords');
    setScenario({ ...scenario, incidentLocation: coords });
  };

  const saveToServer = async () => {
    setIsSaving(true);
    try {
      let svgContent = '';
      if (svgRef.current) {
        // Clone the SVG to manipulate it before saving
        const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
        
        // If there's a background image, embed it into the SVG for the backend
        if (mapImage) {
          const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          img.setAttribute('href', mapImage);
          img.setAttribute('width', '100%');
          img.setAttribute('height', '100%');
          img.setAttribute('preserveAspectRatio', 'none');
          clone.insertBefore(img, clone.firstChild);
        }
        svgContent = clone.outerHTML;
      }

      const response = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          zones,
          svgContent
        })
      });
      const data = await response.json();
      alert(data.message || 'Сохранено');
    } catch (error) {
      console.error(error);
      alert('Ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-blue-600" />
            Карта и масштаб
          </h2>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-center w-full px-4 py-2 bg-slate-100 border border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <Upload className="w-4 h-4 mr-2 text-slate-600" />
              <span className="text-sm text-slate-600">Загрузить схему</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Масштаб (м/px):</span>
              <input 
                type="number" 
                value={scale} 
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-20 px-2 py-1 text-sm border border-slate-300 rounded"
                step="0.1"
              />
            </div>
            <button 
              onClick={() => setShowGlobalMap(!showGlobalMap)}
              className="w-full py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm hover:bg-slate-200 transition-colors"
            >
              {showGlobalMap ? 'Вернуться к схеме' : 'Выбрать место на карте'}
            </button>
            <button 
              onClick={saveToServer}
              disabled={isSaving}
              className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить на сервер'}
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Инструменты</h2>
          <div className="grid grid-cols-2 gap-2">
            <ToolButton active={currentTool === 'fire_origin'} onClick={() => setCurrentTool('fire_origin')} icon={<Crosshair />} label="Очаг" />
            <ToolButton active={currentTool === 'fire_zone'} onClick={() => setCurrentTool('fire_zone')} icon={<Flame />} label="Зона пожара" />
            <ToolButton active={currentTool === 'temp_zone'} onClick={() => setCurrentTool('temp_zone')} icon={<Thermometer />} label="Зона температур" />
            <ToolButton active={currentTool === 'smoke_zone'} onClick={() => setCurrentTool('smoke_zone')} icon={<CloudFog />} label="Задымление" />
            <ToolButton active={currentTool === 'building'} onClick={() => setCurrentTool('building')} icon={<Building />} label="Здание" />
            <ToolButton active={currentTool === 'fence'} onClick={() => setCurrentTool('fence')} icon={<Square />} label="Забор" />
            <ToolButton active={currentTool === 'terrain'} onClick={() => setCurrentTool('terrain')} icon={<Mountain />} label="Рельеф" />
          </div>
          {drawingPoints.length > 0 && (
            <button onClick={finishPolygon} className="mt-3 w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              Завершить фигуру
            </button>
          )}
        </div>

        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Сценарий</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center text-sm text-slate-600 mb-1"><Thermometer className="w-4 h-4 mr-1"/> Температура (°C)</label>
              <input type="number" value={scenario.temperature} onChange={e => setScenario({...scenario, temperature: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            
            <div className="flex gap-4 justify-around py-2">
              <CompassControl 
                label="Направление ветра" 
                value={scenario.windDirection} 
                onChange={(val) => setScenario({...scenario, windDirection: val})} 
                color="blue"
              />
              <CompassControl 
                label="Север" 
                value={scenario.northDirection} 
                onChange={(val) => setScenario({...scenario, northDirection: val})} 
                color="red"
              />
            </div>

            <div>
              <label className="flex items-center text-sm text-slate-600 mb-1"><Wind className="w-4 h-4 mr-1"/> Скорость ветра (м/с)</label>
              <input type="number" value={scenario.windSpeed} onChange={e => setScenario({...scenario, windSpeed: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="flex items-center text-sm text-slate-600 mb-1"><Clock className="w-4 h-4 mr-1"/> Время суток</label>
              <input type="time" value={scenario.timeOfDay} onChange={e => setScenario({...scenario, timeOfDay: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center text-sm text-slate-600"><Droplets className="w-4 h-4 mr-1"/> Водоснабжение</label>
              <button 
                onClick={() => setScenario({...scenario, waterSupplyWorking: !scenario.waterSupplyWorking})}
                className={`px-3 py-1 text-xs font-medium rounded-full ${scenario.waterSupplyWorking ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
              >
                {scenario.waterSupplyWorking ? 'Исправно' : 'Неисправно'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Вводные
          </h2>
          <div className="space-y-2">
            <EventButton label="Отказ техники" />
            <EventButton label="Изменение ветра" />
            <EventButton label="Обрушение конструкции" />
            <EventButton label="Увеличение площади" />
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 bg-slate-200 relative overflow-auto flex items-center justify-center">
        {showGlobalMap ? (
           <div className="w-full h-full">
             <YMaps>
               <Map 
                 defaultState={{ center: [43.4056, 39.9550], zoom: 13 }} // Сириус
                 width="100%" 
                 height="100%"
                 onClick={handleGlobalMapClick}
               >
                 {scenario.incidentLocation && (
                   <Placemark geometry={scenario.incidentLocation} options={{ preset: 'islands#redFireIcon' }} />
                 )}
               </Map>
             </YMaps>
             <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-md z-10">
               <p className="text-sm font-medium">Кликните на карту, чтобы указать место возгорания</p>
               {scenario.incidentLocation && (
                 <p className="text-xs text-slate-500 mt-1">
                   {scenario.incidentLocation[0].toFixed(4)}, {scenario.incidentLocation[1].toFixed(4)}
                 </p>
               )}
             </div>
           </div>
        ) : (mapImage || useEmptyCanvas) ? (
          <div 
            className="relative bg-white shadow-lg cursor-crosshair m-4"
            style={useEmptyCanvas ? { width: 800, height: 600 } : {}}
            onClick={handleMapClick}
          >
            {mapImage && <img src={mapImage} alt="Map" className="max-w-none" style={{ pointerEvents: 'none' }} />}
            <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {useEmptyCanvas && !mapImage && (
                <rect width="100%" height="100%" fill="#ffffff" />
              )}
              {zones.map(zone => (
                <ZoneRenderer key={zone.id} zone={zone} />
              ))}
              {drawingPoints.length > 0 && (
                <polyline 
                  points={drawingPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                  fill="none" 
                  stroke="rgba(59, 130, 246, 0.8)" 
                  strokeWidth="2" 
                  strokeDasharray="4 4"
                />
              )}
              {drawingPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
              ))}
            </svg>

            {/* North Indicator */}
            <div className="absolute top-4 right-4 w-12 h-12 bg-white/80 rounded-full shadow flex items-center justify-center pointer-events-none">
              <div style={{ transform: `rotate(${scenario.northDirection}deg)` }} className="text-red-500 font-bold flex flex-col items-center">
                <span className="text-[10px] leading-none">С</span>
                <div className="w-1 h-4 bg-red-500"></div>
              </div>
            </div>

            {/* Wind Indicator */}
            <div className="absolute bottom-4 left-4 w-12 h-12 bg-white/80 rounded-full shadow flex items-center justify-center pointer-events-none">
              <div style={{ transform: `rotate(${scenario.windDirection}deg)` }} className="text-blue-500 flex flex-col items-center">
                <Wind className="w-6 h-6" />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-slate-400 flex flex-col items-center">
            <MapIcon className="w-16 h-16 mb-4 opacity-50" />
            <p className="mb-4">Загрузите схему объекта или выберите место на глобальной карте</p>
            <button 
              onClick={() => setUseEmptyCanvas(true)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
            >
              Создать пустой план (без схемы)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
        active ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <div className="mb-1">{icon}</div>
      <span className="text-xs font-medium text-center">{label}</span>
    </button>
  );
}

function EventButton({ label }: { label: string }) {
  return (
    <button className="w-full text-left px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 transition-colors">
      {label}
    </button>
  );
}

function ZoneRenderer({ zone }: { zone: Zone; key?: string | number }) {
  if (zone.type === 'fire_origin') {
    return <circle cx={zone.points[0].x} cy={zone.points[0].y} r="6" fill="#ef4444" stroke="#fff" strokeWidth="2" />;
  }
  
  const pointsStr = zone.points.map(p => `${p.x},${p.y}`).join(' ');
  let fill = 'rgba(0,0,0,0)';
  let stroke = '#000';
  let strokeDasharray = 'none';
  
  if (zone.type === 'fire_zone') {
    fill = 'rgba(239, 68, 68, 0.3)';
    stroke = '#ef4444';
  } else if (zone.type === 'temp_zone') {
    fill = 'rgba(245, 158, 11, 0.2)';
    stroke = '#f59e0b';
  } else if (zone.type === 'smoke_zone') {
    fill = 'rgba(100, 116, 139, 0.4)';
    stroke = '#64748b';
  } else if (zone.type === 'building') {
    fill = 'rgba(203, 213, 225, 0.8)'; // slate-300
    stroke = '#475569'; // slate-600
  } else if (zone.type === 'fence') {
    return <polyline points={pointsStr} fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="4 2" />;
  } else if (zone.type === 'terrain') {
    fill = 'rgba(132, 204, 22, 0.2)'; // lime-500
    stroke = '#65a30d'; // lime-600
  }

  return <polygon points={pointsStr} fill={fill} stroke={stroke} strokeWidth="2" strokeDasharray={strokeDasharray} />;
}
