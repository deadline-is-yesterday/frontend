import { useRef, useState, useCallback, useEffect } from 'react';
import { FireSystem, FireSimSnapshot } from '../engine/FireSystem';

const TICK_INTERVAL_MS = 200;

export interface UseLocalFireSimReturn {
  snapshot: FireSimSnapshot | null;
  running: boolean;
  start: (config: {
    width: number;
    height: number;
    walls: Array<{ x: number; y: number; hp: number }>;
    sources: Array<{ x: number; y: number; intensity: number }>;
    trucks?: Array<{ id: string; x: number; y: number; water: number }>;
  }) => void;
  stop: () => void;
  /** Установить рукав и включить воду */
  setHoseNozzle: (truckId: string, nozzleX: number, nozzleY: number, isOpen: boolean) => void;
  /** Добавить источник огня на лету */
  addSource: (x: number, y: number, intensity?: number) => void;
}

export function useLocalFireSim(): UseLocalFireSimReturn {
  const simRef = useRef<FireSystem | null>(null);
  const timerRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<FireSimSnapshot | null>(null);
  const [running, setRunning] = useState(false);

  const stopTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stopTimer();
    simRef.current = null;
    setSnapshot(null);
    setRunning(false);
  }, [stopTimer]);

  const start = useCallback((config: {
    width: number;
    height: number;
    walls: Array<{ x: number; y: number; hp: number }>;
    sources: Array<{ x: number; y: number; intensity: number }>;
    trucks?: Array<{ id: string; x: number; y: number; water: number }>;
  }) => {
    stopTimer();

    const sim = new FireSystem(config.width, config.height);
    for (const w of config.walls) sim.setWall(w.x, w.y, -Math.abs(w.hp));
    for (const s of config.sources) sim.setSource(s.x, s.y, s.intensity);
    for (const t of config.trucks ?? []) sim.setFiretruck(t.id, t.x, t.y, t.water);

    simRef.current = sim;
    setSnapshot(sim.toSnapshot());
    setRunning(true);

    timerRef.current = window.setInterval(() => {
      const s = simRef.current;
      if (!s) return;
      s.update();
      setSnapshot(s.toSnapshot());

      // Остановка если все источники потухли
      if (s.sources.size === 0) {
        console.log(`[FireSim] пожар потушен на тике ${s.ticks}`);
      }
    }, TICK_INTERVAL_MS);
  }, [stopTimer]);

  const setHoseNozzle = useCallback((truckId: string, nozzleX: number, nozzleY: number, isOpen: boolean) => {
    simRef.current?.setHoseNozzle(truckId, nozzleX, nozzleY, isOpen);
  }, []);

  const addSource = useCallback((x: number, y: number, intensity = 1000) => {
    simRef.current?.setSource(x, y, intensity);
  }, []);

  // Cleanup on unmount
  useEffect(() => stopTimer, [stopTimer]);

  return { snapshot, running, start, stop, setHoseNozzle, addSource };
}
