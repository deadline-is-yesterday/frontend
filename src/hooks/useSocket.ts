import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

// ──────────────────────────────────────────────
// Типы событий: расширяй по мере добавления
// ──────────────────────────────────────────────

/** События, которые клиент ОТПРАВЛЯЕТ серверу */
export interface ClientToServerEvents {
  /** Радио — начало/конец передачи */
  ptt_start: () => void;
  ptt_stop: () => void;
  audio_chunk: (data: ArrayBuffer) => void;

  /** Пример: синхронизация сценария */
  scenario_update: (payload: unknown) => void;

  /** Универсальный канал — можно использовать для любых данных */
  message: (payload: unknown) => void;
}

/** События, которые клиент ПРИНИМАЕТ от сервера */
export interface ServerToClientEvents {
  stack_update: (data: { active: boolean }) => void;
  audio_chunk: (data: ArrayBuffer) => void;

  scenario_sync: (data: unknown) => void;
  message: (data: unknown) => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ──────────────────────────────────────────────
// Хук
// ──────────────────────────────────────────────

export interface UseSocketOptions {
  /** URL сокет-сервера (по умолчанию — VITE_API_BASE) */
  url?: string;
  /** Автоматически подключаться при маунте (default: true) */
  autoConnect?: boolean;
  /** Кол-во попыток реконнекта (default: Infinity) */
  reconnectionAttempts?: number;
  /** Задержка между попытками, мс (default: 2000) */
  reconnectionDelay?: number;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    url = SOCKET_URL,
    autoConnect = true,
    reconnectionAttempts = Infinity,
    reconnectionDelay = 2000,
  } = options;

  const socketRef = useRef<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: TypedSocket = io(url, {
      autoConnect,
      reconnection: true,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax: 10_000,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // ── Lifecycle ────────────────────────────
    socket.on('connect', () => {
      console.log('[Socket] connected, id =', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] disconnected:', reason);
      setConnected(false);
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket] reconnect attempt #${attempt}`);
    });

    socket.io.on('reconnect', (attempt) => {
      console.log(`[Socket] reconnected after ${attempt} attempt(s)`);
    });

    socket.io.on('reconnect_failed', () => {
      console.error('[Socket] reconnect failed — giving up');
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, autoConnect, reconnectionAttempts, reconnectionDelay]);

  // ── Типизированная отправка ───────────────
  const emit = useCallback(
    <E extends keyof ClientToServerEvents>(
      event: E,
      ...args: Parameters<ClientToServerEvents[E]>
    ) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        console.warn('[Socket] emit failed — not connected');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.emit(event, ...(args as any[]));
    },
    [],
  );

  // ── Подписка на серверные события ──────────
  const on = useCallback(
    <E extends keyof ServerToClientEvents>(
      event: E,
      handler: ServerToClientEvents[E],
    ) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on(event, handler as any);
      return () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socket.off(event, handler as any);
      };
    },
    [],
  );

  return { socketRef, connected, emit, on };
}
