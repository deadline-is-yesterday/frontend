import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BrickWall, Eraser, 
  Play, Pause, Grid3X3, Image as ImageIcon,
  Settings, Trash2, Undo, Redo,
  Thermometer, Wind, Zap, Eye, EyeOff, Wand2,
  DoorOpen, AppWindow, Layers, Ban, Truck, Navigation, Crosshair, Ruler, Edit2,
  Droplets
} from 'lucide-react';
import { ScenarioState, Zone, ZoneType, Point } from '../types';
import type { UseFireSimReturn } from '../hooks/useFireSim';
import type { StartSimPayload } from '../types/firesim';
import CompassControl from './CompassControl';

// --- ТИПЫ ТЕХНИКИ ---
export type VehicleType = {
  id: string;
  name: string;
  capacity: number;
  type: 'AC' | 'AL' | 'ASA' | 'ASH';
};

export const AVAILABLE_VEHICLES: VehicleType[] = [
  { id: 'ac40_130', name: 'АЦ-40 (130) 63Б', capacity: 2.35, type: 'AC' },
  { id: 'ac40_131', name: 'АЦ-40 (131) 137А', capacity: 2.4, type: 'AC' },
  { id: 'ac32_43253', name: 'АЦ-3,2-40 (43253)', capacity: 3.2, type: 'AC' },
  { id: 'ac50_43118', name: 'АЦ-5,0-40 (43118)', capacity: 5.0, type: 'AC' },
  { id: 'ac60_5557', name: 'АЦ-6,0-40 (Урал-5557)', capacity: 6.0, type: 'AC' },
  { id: 'al_30', name: 'АЛ-30 (Автолестница)', capacity: 0, type: 'AL' },
  { id: 'asa_20', name: 'АСА-20 (Спасательный)', capacity: 0, type: 'ASA' },
  { id: 'ash_uaz', name: 'АШ (Штабной УАЗ)', capacity: 0, type: 'ASH' },
];

type CellType = 'empty' | 'wall' | 'fire' | 'water' | 'door' | 'window';

interface InstructorViewProps {
  scenario: ScenarioState;
  setScenario: (s: ScenarioState) => void;
  zones: Zone[];
  setZones: (z: Zone[]) => void;
  stationResources: Record<string, number>;
  setStationResources: (r: Record<string, number>) => void;
  targetAddress: string;
  setTargetAddress: (addr: string) => void;
  setMapScale?: (scale: number) => void;
  fireSim: UseFireSimReturn;
}

// Компонент клетки
const Cell = React.memo(({ 
  type, x, y, onMouseDown, onMouseEnter, showStructures, showGridLines 
}: { 
  type: CellType, x: number, y: number, 
  onMouseDown: (y: number, x: number) => void, 
  onMouseEnter: (y: number, x: number) => void,
  showStructures: boolean,
  showGridLines: boolean
}) => {
  return (
    <div
      onMouseDown={() => onMouseDown(y, x)}
      onMouseEnter={() => onMouseEnter(y, x)}
      className={`relative ${showGridLines ? 'border-[0.5px] border-slate-300/50' : ''}`}
    >
        {/* СТЕНЫ */}
        {showStructures && type === 'wall' && <div className="absolute inset-0 bg-slate-700 border border-slate-800" />}
        {showStructures && type === 'door' && <div className="absolute inset-0 bg-amber-600/80 border border-amber-700" />}
        {showStructures && type === 'window' && <div className="absolute inset-0 bg-blue-300/50 border border-blue-400/80 backdrop-blur-[1px]" />}
        
        {/* ВОДА */}
        {type === 'water' && <div className="absolute inset-0 bg-blue-500/60 border border-blue-400" />}

        {/* ОГОНЬ */}
        {type === 'fire' && <div className="absolute inset-0 bg-red-600/80 shadow-[0_0_15px_rgba(220,38,38,0.6)] animate-pulse" />}
    </div>
  );
}, (prev, next) => {
  return prev.type === next.type && 
         prev.showStructures === next.showStructures && 
         prev.showGridLines === next.showGridLines;
});

export default function InstructorView({
    scenario, setScenario, zones, setZones,
    stationResources, setStationResources,
    targetAddress, setTargetAddress,
    setMapScale, fireSim
}: InstructorViewProps) {
  
  const [activeTab, setActiveTab] = useState<'map' | 'resources'>('map');
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [zoomLevel, setZoomLevel] = useState(100); 
  const [resolution, setResolution] = useState(60); 
  const [gridRows, setGridRows] = useState(Math.round(60 / (16/9)));

  const [mapImage, setMapImage] = useState<string | null>(null);
  const [grid, setGrid] = useState<CellType[][]>([]);
  
  const [threshold, setThreshold] = useState(120);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  const [history, setHistory] = useState<CellType[][][]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  const [selectedTool, setSelectedTool] = useState<CellType | 'ruler' | null>('wall');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGridLines, setShowGridLines] = useState(true);
  const [showMapImage, setShowMapImage] = useState(true);
  const [showStructures, setShowStructures] = useState(true);

  const [currentZoneTool, setCurrentZoneTool] = useState<ZoneType | 'select'>('select');
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]); 
  const [showCalibrationModal, setShowCalibrationModal] = useState(false); 
  const [realWorldDistance, setRealWorldDistance] = useState<string>('10'); 
  const [currentScale, setCurrentScale] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const selectedToolRef = useRef(selectedTool);
  const isDrawingRef = useRef(isDrawing);

  useEffect(() => { selectedToolRef.current = selectedTool; }, [selectedTool]);
  useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);

  const selectObjectTool = (tool: CellType) => {
    setSelectedTool(tool);
    setCurrentZoneTool('select'); 
    setCalibrationPoints([]); 
  };

  const selectRulerTool = () => {
    setSelectedTool('ruler');
    setCurrentZoneTool('select');
    setCalibrationPoints([]); 
  };

  useEffect(() => {
    const newRows = Math.round(resolution / aspectRatio);
    setGridRows(newRows);

    setGrid(prev => {
      const newGrid: CellType[][] = Array(newRows).fill(null).map(() => Array(resolution).fill('empty'));
      if (prev.length > 0) {
        for (let y = 0; y < Math.min(newRows, prev.length); y++) {
            for (let x = 0; x < Math.min(resolution, prev[0].length); x++) {
                newGrid[y][x] = prev[y][x];
            }
        }
      }
      return newGrid;
    });
    setHistory([]);
    setHistoryStep(-1);
  }, [resolution, aspectRatio]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTab !== 'map') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (selectedTool === 'ruler') {
        const newPoints = [...calibrationPoints, { x, y }];
        if (newPoints.length === 2) {
            setCalibrationPoints(newPoints);
            setShowCalibrationModal(true);
        } else {
            setCalibrationPoints(newPoints);
        }
        return;
    }

    if (currentZoneTool !== 'select') {
        setDrawingPoints([...drawingPoints, { x, y }]);
        return;
    }
  };

  const finishPolygon = () => {
    if (drawingPoints.length > 2) {
      setZones([...zones, { id: Date.now().toString(), type: currentZoneTool as ZoneType, points: drawingPoints, floor: 1 }]);
    }
    setDrawingPoints([]);
    setCurrentZoneTool('select');
  };

  const confirmCalibration = () => {
      if (calibrationPoints.length !== 2) return;
      const dx = calibrationPoints[1].x - calibrationPoints[0].x;
      const dy = calibrationPoints[1].y - calibrationPoints[0].y;
      const pixelDistance = Math.sqrt(dx*dx + dy*dy);
      const meters = parseFloat(realWorldDistance);
      if (!isNaN(meters) && meters > 0 && pixelDistance > 0) {
          const scale = meters / pixelDistance;
          setCurrentScale(scale);
          if (setMapScale) setMapScale(scale);
          setShowCalibrationModal(false);
          setCalibrationPoints([]);
          selectObjectTool('wall');
      } else {
          alert("Некорректное значение дистанции");
      }
  };

  const detectWalls = useCallback((sensitivity: number) => {
    if (!mapImage) return;
    const img = new Image();
    img.src = mapImage;
    img.onload = () => {
        const sampleRate = 5; 
        const renderWidth = resolution * sampleRate;
        const renderHeight = gridRows * sampleRate;
        const canvas = document.createElement('canvas');
        canvas.width = renderWidth;
        canvas.height = renderHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, renderWidth, renderHeight);
        const imageData = ctx.getImageData(0, 0, renderWidth, renderHeight).data;
        setGrid(prevGrid => {
            const newGrid = prevGrid.map(row => [...row]);
            for (let gy = 0; gy < gridRows; gy++) {
                for (let gx = 0; gx < resolution; gx++) {
                    if (['fire', 'water', 'door', 'window'].includes(newGrid[gy][gx])) continue;
                    let totalDarknessScore = 0;
                    let samples = 0;
                    const startX = gx * sampleRate;
                    const startY = gy * sampleRate;
                    for (let y = startY; y < startY + sampleRate; y++) {
                        for (let x = startX; x < startX + sampleRate; x++) {
                            const i = (y * renderWidth + x) * 4;
                            const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3 / 255;
                            totalDarknessScore += Math.pow(1 - brightness, 3);
                            samples++;
                        }
                    }
                    const avgScore = totalDarknessScore / samples;
                    const triggerLevel = Math.pow((255 - sensitivity) / 255, 3);
                    if (avgScore > triggerLevel) newGrid[gy][gx] = 'wall';
                    else if (newGrid[gy][gx] === 'wall') newGrid[gy][gx] = 'empty';
                }
            }
            return newGrid;
        });
    };
  }, [mapImage, resolution, gridRows]);

  useEffect(() => {
      if (isAutoDetecting) detectWalls(threshold);
  }, [threshold, isAutoDetecting, detectWalls]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const ratio = img.width / img.height;
            setAspectRatio(ratio);
            setMapImage(event.target?.result as string);
            setGridRows(Math.round(resolution / ratio));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const saveToHistory = (newGrid: CellType[][]) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newGrid.map(row => [...row]));
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    setGrid(newGrid);
  };

  const undo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setGrid(history[prevStep].map(row => [...row]));
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setGrid(history[nextStep].map(row => [...row]));
    }
  };

  const clearAll = () => {
      if(confirm('Очистить всё поле и сбросить масштаб? Это действие нельзя отменить.')) {
          const emptyGrid = Array(gridRows).fill(null).map(() => Array(resolution).fill('empty'));
          setGrid(emptyGrid);
          saveToHistory(emptyGrid);
          setCurrentScale(null);
          setCalibrationPoints([]);
          if(setMapScale) setMapScale(1);
          setZones([]); 
      }
  };

  const handleMouseDown = useCallback((y: number, x: number) => {
    if (isPlaying || selectedTool === 'ruler' || selectedTool === null) return; 
    setIsDrawing(true);
    isDrawingRef.current = true;
    
    setGrid(prev => {
        const newGrid = prev.map(row => [...row]);
        const targetTool = selectedToolRef.current; 
        const target = targetTool === 'empty' ? 'empty' : targetTool as CellType;
        if (newGrid[y][x] !== target) newGrid[y][x] = target;
        return newGrid;
    });
  }, [isPlaying, selectedTool]);

  const handleMouseEnter = useCallback((y: number, x: number) => {
    if (isDrawingRef.current && !isPlaying && selectedToolRef.current !== 'ruler' && selectedToolRef.current !== null) {
        setGrid(prev => {
            const newGrid = prev.map(row => [...row]);
            const targetTool = selectedToolRef.current;
            const target = targetTool === 'empty' ? 'empty' : targetTool as CellType;
            if (newGrid[y][x] !== target) newGrid[y][x] = target;
            return newGrid;
        });
    }
  }, [isPlaying]);

  const handleMouseUp = () => {
    if (isDrawingRef.current) {
        setIsDrawing(false);
        isDrawingRef.current = false;
        saveToHistory(grid);
    }
  };

  return (
    <div className="flex h-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <div className="w-80 flex flex-col border-r border-slate-200 bg-white z-20 shadow-lg h-full flex-shrink-0">
        <div className="flex border-b border-slate-200 shrink-0">
            <button onClick={() => setActiveTab('map')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'map' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Карта</button>
            <button onClick={() => setActiveTab('resources')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'resources' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Ресурсы</button>
        </div>

        {activeTab === 'map' ? (
            <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Объекты</div>
                    <div className="grid grid-cols-3 gap-2">
                        <ToolButton active={selectedTool === 'wall'} onClick={() => selectObjectTool('wall')} icon={<BrickWall />} label="СТЕНА" />
                        <ToolButton active={selectedTool === 'door'} onClick={() => selectObjectTool('door')} icon={<DoorOpen />} label="ДВЕРЬ" color="text-amber-600" />
                        <ToolButton active={selectedTool === 'window'} onClick={() => selectObjectTool('window')} icon={<AppWindow />} label="ОКНО" color="text-blue-500" />
                        <ToolButton active={selectedTool === 'water'} onClick={() => selectObjectTool('water')} icon={<Droplets />} label="ВОДА" color="text-blue-600" />
                        <ToolButton active={selectedTool === 'empty'} onClick={() => selectObjectTool('empty')} icon={<Eraser />} label="ЛАСТИК" />
                    </div>
                    
                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-4 mb-2">Зоны & Масштаб</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                            <ToolButton active={selectedTool === 'fire'} onClick={() => selectObjectTool('fire')} icon={<Crosshair />} label="ОЧАГ ПОЖАРА" color="text-red-600" />
                        </div>
                        <div className="col-span-2">
                            {currentScale ? (
                                <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg flex items-center justify-between group">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-blue-600 font-bold uppercase">Масштаб</span>
                                        <span className="text-xs text-slate-900 font-mono">1px = {currentScale.toFixed(3)}м</span>
                                    </div>
                                    <button onClick={selectRulerTool} className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors" title="Изменить масштаб"><Edit2 className="w-3 h-3" /></button>
                                </div>
                            ) : (
                                <button onClick={selectRulerTool} className={`w-full flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all ${selectedTool === 'ruler' ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-transparent border-slate-200 hover:bg-slate-50'}`}>
                                    <div className="mb-1"><Ruler className="w-4 h-4" /></div>
                                    <span className="text-[9px] font-bold uppercase">Задать Масштаб</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {drawingPoints.length > 0 && (
                        <button onClick={finishPolygon} className="mt-3 w-full py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-500 shadow-md">ЗАВЕРШИТЬ ЗОНУ ({drawingPoints.length})</button>
                    )}
                </div>

                <div className="h-px bg-slate-200 mx-4 mb-4"></div>

                <div className="flex gap-2 px-4 mb-4">
                    <button onClick={undo} disabled={historyStep <= 0} className="flex-1 p-2 bg-white rounded hover:bg-slate-50 disabled:opacity-30 text-slate-600 border border-slate-200 shadow-sm"><Undo className="w-4 h-4 mx-auto" /></button>
                    <button onClick={redo} disabled={historyStep >= history.length - 1} className="flex-1 p-2 bg-white rounded hover:bg-slate-50 disabled:opacity-30 text-slate-600 border border-slate-200 shadow-sm"><Redo className="w-4 h-4 mx-auto" /></button>
                    <button onClick={clearAll} className="flex-1 p-2 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200 shadow-sm"><Trash2 className="w-4 h-4 mx-auto" /></button>
                </div>
            </div>
        ) : (
            <div className="flex-1 flex flex-col p-4 space-y-6 overflow-y-auto">
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Navigation className="w-3 h-3" /> Целевой адрес</div>
                    <input type="text" value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} placeholder="Напр: ул. Ленина, 42" className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:border-blue-500 outline-none placeholder-slate-400 shadow-sm" />
                    <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">Этот адрес должен выяснить диспетчер в разговоре.</p>
                </div>
                <div className="h-px bg-slate-200"></div>
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Truck className="w-3 h-3" /> Конфигурация Депо</div>
                    <div className="space-y-3">
                        {AVAILABLE_VEHICLES.map(v => (
                            <div key={v.id} className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between hover:border-blue-300 transition-colors shadow-sm">
                                <div className="flex-1 min-w-0 pr-2">
                                    <div className="text-xs font-bold text-slate-800 truncate">{v.name}</div>
                                    <div className="text-[10px] text-slate-500">{v.capacity > 0 ? `Вода: ${v.capacity}т` : 'Спецтехника'}</div>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 rounded p-1 border border-slate-200">
                                    <button onClick={() => setStationResources({...stationResources, [v.id]: Math.max(0, (stationResources[v.id] || 0) - 1)})} className="w-6 h-6 rounded bg-white text-slate-500 hover:text-blue-600 border border-slate-200 flex items-center justify-center">-</button>
                                    <span className="w-6 text-center text-sm font-mono font-bold text-blue-600">{stationResources[v.id] || 0}</span>
                                    <button onClick={() => setStationResources({...stationResources, [v.id]: (stationResources[v.id] || 0) + 1})} className="w-6 h-6 rounded bg-white text-slate-500 hover:text-blue-600 border border-slate-200 flex items-center justify-center">+</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-100">
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 z-10 shadow-sm shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 p-1 bg-slate-50 rounded-lg border border-slate-200">
                 <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors px-3 py-1.5 rounded">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-[10px] font-bold text-slate-700">СХЕМА</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
                <div className="w-px h-4 bg-slate-300"></div>
                <button onClick={() => setShowMapImage(!showMapImage)} className={`p-1.5 rounded hover:bg-slate-200 ${showMapImage ? 'text-blue-600' : 'text-slate-400'}`}>
                    {showMapImage ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                </button>
            </div>

            {mapImage && (
              <div className={`flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200 transition-all ${isPlaying ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                  <button onClick={() => { const newState = !isAutoDetecting; setIsAutoDetecting(newState); if(newState) detectWalls(threshold); else saveToHistory(grid); }} className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all ${isAutoDetecting ? 'bg-purple-600 text-white shadow-md' : 'hover:bg-slate-200 text-purple-600'}`}>
                      <Wand2 className="w-4 h-4" /><span className="text-[10px] font-bold">{isAutoDetecting ? 'ГОТОВО' : 'АВТО'}</span>
                  </button>
                  {isAutoDetecting && (<div className="flex items-center gap-2 px-2"><input type="range" min="10" max="250" step="5" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-24 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-purple-500"/></div>)}
              </div>
            )}

            <div className="h-6 w-px bg-slate-200"></div>

            <div className={`flex flex-col w-40 transition-all ${isPlaying ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                 <span className="text-[8px] text-slate-400 font-bold mb-0.5 flex justify-between"><span>ДЕТАЛИЗАЦИЯ</span><span>{resolution} x {gridRows}</span></span>
                 <div className="flex items-center gap-2 bg-slate-50 p-1 rounded border border-slate-200">
                    <Grid3X3 className="w-3 h-3 text-slate-400" />
                    <input type="range" min="20" max="150" step="2" value={resolution} onChange={(e) => setResolution(Number(e.target.value))} className="h-1.5 flex-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                 </div>
            </div>

            <div className="flex flex-col w-32">
                 <span className="text-[8px] text-slate-400 font-bold mb-0.5 flex justify-between"><span>ZOOM</span><span>{zoomLevel}%</span></span>
                 <input type="range" min="50" max="300" step="10" value={zoomLevel} onChange={(e) => setZoomLevel(Number(e.target.value))} className="h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
            </div>
            
            <div className="flex items-center gap-2">
                <button onClick={() => setShowGridLines(!showGridLines)} className={`p-2 rounded border border-slate-200 ${showGridLines ? 'bg-blue-100 text-blue-600' : 'bg-white text-slate-400'}`}><Grid3X3 className="w-4 h-4" /></button>
                <button onClick={() => setShowStructures(!showStructures)} className={`p-2 rounded border border-slate-200 ${!showStructures ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400'}`}>{showStructures ? <Layers className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</button>
            </div>
          </div>

          <button onClick={async () => {
            const next = !isPlaying;
            setIsPlaying(next);
            setScenario({ ...scenario, simulationStarted: next });
            if (next) {
              const walls: StartSimPayload['walls'] = [];
              const sources: StartSimPayload['sources'] = [];
              for (let y = 0; y < grid.length; y++) {
                for (let x = 0; x < (grid[y]?.length ?? 0); x++) {
                  if (grid[y][x] === 'wall') walls.push({ x, y, hp: 100 });
                  else if (grid[y][x] === 'fire') sources.push({ x, y, intensity: 100 });
                }
              }
              try {
                await fireSim.startSim({
                  map_id: 'default',
                  width: resolution,
                  height: gridRows,
                  walls,
                  sources,
                  trucks: [],
                });
              } catch (err) {
                console.error('[InstructorView] failed to start sim:', err);
              }
            } else {
              try {
                await fireSim.resetSim({ map_id: 'default' });
              } catch (err) {
                console.error('[InstructorView] failed to reset sim:', err);
              }
            }
          }} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md border ${isPlaying ? 'bg-red-50 text-red-500 border-red-200 animate-pulse' : 'bg-green-600 text-white border-green-600 hover:bg-green-500'}`}>
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />} {isPlaying ? 'АКТИВНО' : 'ЗАПУСК'}
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] bg-slate-50 p-10 flex items-start justify-center">
            <div className="relative shadow-xl bg-white border border-slate-300 select-none transition-all duration-100 ease-out origin-top" style={{ width: `${zoomLevel}%`, aspectRatio: `${aspectRatio}`, minHeight: mapImage ? 'auto' : '500px' }} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onClick={handleMapClick}>
              {mapImage && showMapImage && <img src={mapImage} alt="Plan" className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-60 mix-blend-multiply" />}
              {!mapImage && showMapImage && <div className="absolute inset-0 flex items-center justify-center text-slate-300 pointer-events-none border-2 border-dashed border-slate-300"><span className="text-2xl font-black opacity-20 rotate-[-12deg] tracking-widest">НЕТ СХЕМЫ</span></div>}

              <div className="absolute inset-0 z-10" style={{ display: 'grid', gridTemplateColumns: `repeat(${resolution}, 1fr)`, gridTemplateRows: `repeat(${gridRows}, 1fr)` }}>
                {grid.map((row, y) => row.map((cell, x) => (
                    <Cell key={`${y}-${x}`} type={cell} x={x} y={y} onMouseDown={handleMouseDown} onMouseEnter={handleMouseEnter} showStructures={showStructures} showGridLines={showGridLines} />
                )))}
              </div>

              <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-20">
                  {zones.map(zone => <ZoneRenderer key={zone.id} zone={zone} />)}
                  {drawingPoints.length > 0 && currentZoneTool !== 'select' && <polyline points={drawingPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="5 5" />}
                  {calibrationPoints.length > 0 && (
                      <g>
                          <line x1={calibrationPoints[0].x} y1={calibrationPoints[0].y} x2={calibrationPoints[1]?.x || calibrationPoints[0].x} y2={calibrationPoints[1]?.y || calibrationPoints[0].y} stroke="#ca8a04" strokeWidth="2" strokeDasharray="4 4" />
                          <circle cx={calibrationPoints[0].x} cy={calibrationPoints[0].y} r="4" fill="#ca8a04" />
                          {calibrationPoints[1] && <circle cx={calibrationPoints[1].x} cy={calibrationPoints[1].y} r="4" fill="#ca8a04" />}
                      </g>
                  )}
              </svg>

              {showCalibrationModal && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-200 p-4 rounded-xl shadow-2xl z-50 flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-slate-800 uppercase">Калибровка Масштаба</h3>
                      <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500">Реальная длина (метры):</label>
                          <input type="number" step="0.01" autoFocus value={realWorldDistance} onChange={e => setRealWorldDistance(e.target.value)} className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 outline-none focus:border-blue-500" />
                      </div>
                      <div className="flex gap-2 justify-end mt-2">
                          <button onClick={() => { setShowCalibrationModal(false); setCalibrationPoints([]); }} className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800">Отмена</button>
                          <button onClick={confirmCalibration} className="px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold">Применить</button>
                      </div>
                  </div>
              )}
            </div>
        </div>
      </div>
      
      {/* ПРАВАЯ ПАНЕЛЬ */}
      <div className="w-72 border-l border-slate-200 bg-white p-4 flex flex-col gap-6 overflow-y-auto z-10 shrink-0">
        <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Settings className="w-3 h-3" /> Условия Среды</h3>
            <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Thermometer className="w-3 h-3"/> Температура (°C)</label>
                  <input type="number" step="0.1" value={scenario.temperature} onChange={e => setScenario({...scenario, temperature: Number(e.target.value)})} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-800 focus:border-blue-500 outline-none" />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 mb-1 flex items-center gap-1"><Wind className="w-3 h-3"/> Ветер (м/с)</label>
                    <input type="number" step="0.1" value={scenario.windSpeed} onChange={e => setScenario({...scenario, windSpeed: Number(e.target.value)})} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-800 focus:border-blue-500 outline-none" />
                </div>
                <div className="pt-2 flex justify-center">
                    <CompassControl label="Направление" value={scenario.windDirection} onChange={(val) => setScenario({...scenario, windDirection: val})} color="blue" />
                </div>
            </div>
        </div>
        <div className="flex-1">
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Zap className="w-3 h-3 text-amber-500" /> Вводные события</h3>
           <div className="space-y-2">
                <EventButton label="⚠️ Отказ гидранта №1" active={isPlaying} />
                <EventButton label="⚠️ Обрушение кровли" active={isPlaying} />
                <EventButton label="💨 Резкая смена ветра" active={isPlaying} />
           </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, icon, color, label }: any) {
  return (
    <button onClick={onClick} className={`w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-150 border relative group ${active ? `border-slate-300 bg-white ${color} shadow-md scale-105 z-10 ring-1 ring-blue-100` : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
      <div className={`${active ? `drop-shadow-sm` : ''} transform transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
      <span className="text-[8px] font-bold mt-1.5 tracking-widest opacity-80">{label}</span>
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r" />}
    </button>
  );
}

function EventButton({ label, active }: { label: string, active: boolean }) {
    return <button disabled={!active} className={`w-full text-left px-3 py-2.5 rounded text-xs transition-all border ${active ? 'bg-white border-slate-200 text-slate-800 hover:bg-blue-50 hover:border-blue-200 cursor-pointer active:scale-95 shadow-sm' : 'bg-slate-50 border-transparent text-slate-400 cursor-not-allowed opacity-50'}`}>{label}</button>
}

function ZoneRenderer({ zone }: { zone: Zone }) {
    const pointsStr = zone.points.map(p => `${p.x},${p.y}`).join(' ');
    let fill = 'rgba(37, 99, 235, 0.1)'; 
    let stroke = '#2563eb';
    if (zone.type === 'smoke_zone') { fill = 'rgba(107, 114, 128, 0.3)'; stroke = '#6b7280'; }
    return <polygon points={pointsStr} fill={fill} stroke={stroke} strokeWidth="1.5" />;
}