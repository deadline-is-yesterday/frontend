import { Map as MapIcon, CheckCircle } from 'lucide-react';
import type { MapLayout } from '../types/firemap';
import FireMapView from './FireMapView';

interface RTPViewProps {
  sharedLayout: MapLayout | null;
}

export default function RTPView({ sharedLayout }: RTPViewProps) {
  return (
    <div className="flex h-full bg-slate-100">
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* Статус карты */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Карта обстановки</h3>
            {sharedLayout ? (
              <div className="p-2 border border-emerald-200 rounded-lg bg-emerald-50 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-medium text-emerald-800">Карта получена</div>
                  <div className="text-emerald-600 text-xs mt-0.5">
                    Техника: {sharedLayout.placed_equipment.length} ед.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2 border border-amber-200 rounded-lg bg-amber-50 text-sm">
                <div className="font-medium text-amber-800">Ожидание карты от НШ</div>
                <div className="text-amber-600 text-xs mt-0.5">Запросите карту по рации</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {sharedLayout ? (
          <FireMapView
            dataPrefix="/headquarters"
            readOnly
            initialLayout={sharedLayout}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center bg-white/90 p-6 rounded-2xl shadow-lg">
              <MapIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-slate-800">Схема расстановки сил</h2>
              <p className="text-slate-500 mt-2 max-w-md mx-auto">
                Запросите актуальную карту у начальника штаба по рации.
                После отправки карта отобразится здесь.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
