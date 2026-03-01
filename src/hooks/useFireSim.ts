import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  FireSimState,
  StartSimPayload,
  SetSourcePayload,
  ResetPayload,
} from '../types/firesim';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

interface ServerEvents {
  state_update: (state: FireSimState) => void;
}

interface ClientEvents {
  join_sim: (payload: { map_id: string }) => void;
}

type FireSimSocket = Socket<ServerEvents, ClientEvents>;

export interface UseFireSimReturn {
  simState: FireSimState | null;
  connected: boolean;
  startSim: (payload: StartSimPayload) => Promise<void>;
  setSource: (payload: SetSourcePayload) => Promise<void>;
  resetSim: (payload: ResetPayload) => Promise<void>;
  fetchState: (mapId: string) => Promise<FireSimState | null>;
  /** Сообщить бэку о подключении/отключении гидранта к машине */
  setHydrantConnected: (truckId: string, connected: boolean) => void;
  /** Сообщить бэку о включении/выключении полива */
  setHoseState: (truckId: string, nozzleX: number, nozzleY: number, isOpen: boolean) => void;
}

export function useFireSim(mapId: string | null): UseFireSimReturn {
  const socketRef = useRef<FireSimSocket | null>(null);
  const [simState, setSimState] = useState<FireSimState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!mapId) {
      setConnected(false);
      setSimState(null);
      return;
    }

    const socket: FireSimSocket = io(`${API_BASE}/firesim`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[FireSim] connected, id =', socket.id);
      setConnected(true);
      socket.emit('join_sim', { map_id: mapId });
    });

    socket.on('disconnect', (reason) => {
      console.warn('[FireSim] disconnected:', reason);
      setConnected(false);
    });

    socket.on('state_update', (state) => {
      setSimState(state);
    });

    socket.io.on('reconnect', () => {
      console.log('[FireSim] reconnected, re-joining sim');
      socket.emit('join_sim', { map_id: mapId });
    });

    socket.on('connect_error', (err) => {
      console.error('[FireSim] connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [mapId]);

  // --- REST helpers ---

  const startSim = useCallback(async (payload: StartSimPayload) => {
    await fetch(`${API_BASE}/firesim/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }, []);

  const setSource = useCallback(async (payload: SetSourcePayload) => {
    await fetch(`${API_BASE}/firesim/set_source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }, []);

  const resetSim = useCallback(async (payload: ResetPayload) => {
    await fetch(`${API_BASE}/firesim/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSimState(null);
  }, []);

  const fetchState = useCallback(async (id: string): Promise<FireSimState | null> => {
    try {
      const res = await fetch(`${API_BASE}/firesim/state?map_id=${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const setHydrantConnected = useCallback((truckId: string, connected: boolean) => {
    socketRef.current?.emit('hydrant_update' as any, {
      map_id: mapId,
      truck_id: truckId,
      connected,
    });
  }, [mapId]);

  const setHoseState = useCallback((truckId: string, nozzleX: number, nozzleY: number, isOpen: boolean) => {
    socketRef.current?.emit('hose_update' as any, {
      map_id: mapId,
      truck_id: truckId,
      nozzle_x: nozzleX,
      nozzle_y: nozzleY,
      is_open: isOpen,
    });
  }, [mapId]);

  return { simState, connected, startSim, setSource, resetSim, fetchState, setHydrantConnected, setHoseState };
}
