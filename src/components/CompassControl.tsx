import React from 'react';

interface CompassControlProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  color?: 'blue' | 'red';
}

export default function CompassControl({ value, onChange, label, color = 'blue' }: CompassControlProps) {
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const updateAngle = (clientX: number, clientY: number) => {
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      onChange(Math.round(angle));
    };

    updateAngle(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateAngle(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const bgColor = color === 'blue' ? '#3b82f6' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-slate-600 mb-1">{label} ({value}°)</span>
      <div 
        className="relative w-16 h-16 rounded-full border-2 border-slate-300 bg-slate-50 cursor-pointer"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-400 font-bold pointer-events-none">
          <span className="absolute top-0.5">С</span>
          <span className="absolute bottom-0.5">Ю</span>
          <span className="absolute right-1">В</span>
          <span className="absolute left-1">З</span>
        </div>
        <div 
          className="absolute top-0 left-1/2 w-0.5 h-1/2 origin-bottom pointer-events-none"
          style={{ 
            transform: `translateX(-50%) rotate(${value}deg)`,
            backgroundColor: bgColor
          }}
        >
          <div 
            className="w-2.5 h-2.5 rounded-full absolute -top-1 -left-1" 
            style={{ backgroundColor: bgColor }} 
          />
        </div>
      </div>
    </div>
  );
}
