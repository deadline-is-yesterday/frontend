import React, { useEffect, useMemo, useState } from 'react';

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  targetId?: string;
};

interface TutorialOverlayProps {
  open: boolean;
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const CARD_WIDTH = 340;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function TutorialOverlay({
  open,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: TutorialOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open || !step.targetId) {
      setTargetRect(null);
      return;
    }
    const updateRect = () => {
      const target = document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`);
      setTargetRect(target?.getBoundingClientRect() ?? null);
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    const timer = window.setInterval(updateRect, 300);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      window.clearInterval(timer);
    };
  }, [open, step.targetId]);

  const cardStyle = useMemo(() => {
    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      } as const;
    }
    const margin = 12;
    const top = targetRect.bottom + margin;
    const left = clamp(targetRect.left, 8, window.innerWidth - CARD_WIDTH - 8);
    const maxBottom = window.innerHeight - 8;
    const fallbackTop = clamp(targetRect.top - 220, 8, maxBottom - 200);
    return {
      top: `${top + 200 < maxBottom ? top : fallbackTop}px`,
      left: `${left}px`,
    } as const;
  }, [targetRect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-slate-950/55" />

      {targetRect && (
        <div
          className="absolute rounded-xl border-2 border-cyan-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] pointer-events-none"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      <div
        className="absolute bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-[340px]"
        style={cardStyle}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
          Обучение • Шаг {stepIndex + 1} из {totalSteps}
        </div>
        <h3 className="text-sm font-bold text-slate-900 mt-1">{step.title}</h3>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{step.body}</p>

        <div className="mt-4 flex items-center gap-2">
          <button
            className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            onClick={onPrev}
            disabled={stepIndex === 0}
          >
            Назад
          </button>
          <button
            className="px-2 py-1 text-xs rounded bg-cyan-600 text-white hover:bg-cyan-500"
            onClick={onNext}
          >
            {stepIndex + 1 === totalSteps ? 'Завершить' : 'Далее'}
          </button>
          <button
            className="ml-auto px-2 py-1 text-xs rounded text-slate-500 hover:bg-slate-100"
            onClick={onSkip}
          >
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
}
