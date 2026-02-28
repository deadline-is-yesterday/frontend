import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Radio } from 'lucide-react';
import { Role } from '../types';

const BACKEND_URL = import.meta.env.VITE_API_URL;
console.log("URL БЭКЕНДА ИЗ ENV:", BACKEND_URL);
const BUFFER_SIZE = 4096;

interface Props {
  role: Role;
}

export default function CommunicationPanel({ role: _role }: Props) {
  const [isActive, setIsActive] = useState(false);
  const [someoneActive, setSomeoneActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const txCtxRef = useRef<AudioContext | null>(null);
  const rxCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const isTransmittingRef = useRef<boolean>(false);

  function getRxCtx() {
    if (!rxCtxRef.current || rxCtxRef.current.state === 'closed') {
      rxCtxRef.current = new AudioContext();
      nextPlayTimeRef.current = 0;
    }
    return rxCtxRef.current;
  }

  function playPcm(data: ArrayBuffer) {
    if (isTransmittingRef.current) return;
    const pcm = new Float32Array(data);
    const ctx = getRxCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const buffer = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buffer.copyToChannel(pcm, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const now = ctx.currentTime;
    const startAt = Math.max(nextPlayTimeRef.current, now);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
  }

  useEffect(() => {
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on('stack_update', ({ active }: { active: boolean }) => {
      setSomeoneActive(active);
    });

    socket.on('audio_chunk', (data: ArrayBuffer) => {
      playPcm(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function startTransmitting() {
    setError(null);
    setIsActive(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia не поддерживается (требуется HTTPS или localhost)');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      txCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);

      // muted gain node — required for Chrome to fire onaudioprocess
      const mute = ctx.createGain();
      mute.gain.value = 0;

      processor.onaudioprocess = (e) => {
        if (!isTransmittingRef.current) return;
        const pcm = e.inputBuffer.getChannelData(0);
        socketRef.current?.emit('audio_chunk', pcm.buffer.slice(0));
      };

      source.connect(processor);
      processor.connect(mute);
      mute.connect(ctx.destination);

      isTransmittingRef.current = true;
      socketRef.current?.emit('ptt_start');
    } catch (err) {
      console.error('[Radio] error:', err);
      setIsActive(false);
      setError(err instanceof Error ? err.message : 'Нет доступа к микрофону');
    }
  }

  function stopTransmitting() {
    isTransmittingRef.current = false;
    txCtxRef.current?.close();
    txCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    socketRef.current?.emit('ptt_stop');
    setIsActive(false);
    nextPlayTimeRef.current = 0;
  }

  function handleToggle() {
    if (isActive) {
      stopTransmitting();
    } else {
      startTransmitting();
    }
  }

  return (
    <div className="h-16 bg-slate-900 border-t border-slate-800 flex items-center px-6 text-white justify-between shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-slate-300">Канал: <span className="text-white">Общий (Пожар)</span></span>
        </div>

        {someoneActive && (
          <div className="flex items-center gap-3 ml-4">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <span className="text-sm text-emerald-400 font-medium">В эфире</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button
          onClick={handleToggle}
          className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg ${
            isActive
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200 shadow-slate-900/20'
          }`}
        >
          {isActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          <span>{isActive ? 'Рация включена' : 'Включить рацию'}</span>
        </button>
      </div>
    </div>
  );
}