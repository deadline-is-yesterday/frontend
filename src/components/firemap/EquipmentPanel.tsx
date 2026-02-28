import { Truck } from 'lucide-react';
import type { EquipmentSpec } from '../../types/firemap';
import { iconUrl } from './iconUrl';

interface EquipmentPanelProps {
  equipment: EquipmentSpec[];
  pendingEquipmentId: string | null;
  onSelect: (id: string) => void;
}

export default function EquipmentPanel({
  equipment,
  pendingEquipmentId,
  onSelect,
}: EquipmentPanelProps) {
  return (
    <div className="w-56 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-3 py-2 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Техника
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {equipment.map(eq => (
          <button
            key={eq.id}
            onClick={() => onSelect(eq.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors border-b border-slate-100 last:border-0 ${
              pendingEquipmentId === eq.id
                ? 'bg-blue-50 text-blue-700 border-l-4 border-l-blue-500'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <EquipmentIcon iconPath={eq.icon_path} size={32} />
            <span className="truncate font-medium">{eq.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function EquipmentIcon({
  iconPath,
  size = 32,
  className = '',
}: {
  iconPath: string;
  size?: number;
  className?: string;
}) {
  if (!iconPath) {
    return (
      <span className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <Truck className="text-slate-400" style={{ width: size * 0.7, height: size * 0.7 }} />
      </span>
    );
  }
  return (
    <img
      src={iconUrl(iconPath)}
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className}`}
      onError={e => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
