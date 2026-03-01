import { useState, useEffect } from 'react';
import type { FireMap, EquipmentSpec, MapLayout } from '../../types/firemap';

const MOCK_MAP: FireMap = {
  id: 'default',
  name: 'Главный корпус',
  plan_url: '',
  scale_m_per_px: 0.05,
  hydrants: [
    { id: 'h1', x: 200, y: 150, label: 'ПГ-1' },
    { id: 'h2', x: 620, y: 290, label: 'ПГ-2' },
    { id: 'h3', x: 410, y: 510, label: 'ПГ-3' },
  ],
};

const MOCK_EQUIPMENT: EquipmentSpec[] = [
  {
    id: 'ac40',
    name: 'АЦ-40',
    icon_path: 'Лист 02/02.Пожарная автоцистерна.png',
    hoses: [
      { id: 'h1', max_length_m: 100 },
      { id: 'h2', max_length_m: 100 },
    ],
    branchings: [{ id: 'b1', type: 'three_way' }],
    placed_id: null, x: null, y: null,
  },
  {
    id: 'al30',
    name: 'АЛ-30',
    icon_path: 'Лист 02/04.Пожарная автолестница.png',
    hoses: [{ id: 'h1', max_length_m: 60 }],
    branchings: [],
    placed_id: null, x: null, y: null,
  },
  {
    id: 'asa',
    name: 'АСА',
    icon_path: 'Лист 01/02.Пожарный аварийно–спасательный автомобиль.png',
    hoses: [],
    branchings: [],
    placed_id: null, x: null, y: null,
  },
  {
    id: 'apm',
    name: 'АПМ',
    icon_path: 'Лист 03/01.Мотопомпа пожарная: переносная.png',
    hoses: [{ id: 'h1', max_length_m: 40 }],
    branchings: [{ id: 'b1', type: 'two_way' }],
    placed_id: null, x: null, y: null,
  },
];

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export function useFireMapData(apiPrefix: string): {
  map: FireMap | null;
  equipment: EquipmentSpec[];
  savedLayout: MapLayout | null;
  loading: boolean;
  error: string | null;
} {
  const [map, setMap] = useState<FireMap | null>(null);
  const [equipment, setEquipment] = useState<EquipmentSpec[]>([]);
  const [savedLayout, setSavedLayout] = useState<MapLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [mapRes, eqRes, layoutRes] = await Promise.all([
          fetch(`${API_BASE}${apiPrefix}/maps`, { signal: controller.signal }),
          fetch(`${API_BASE}${apiPrefix}/equipment`, { signal: controller.signal }),
          fetch(`${API_BASE}${apiPrefix}/maps/layout`, { signal: controller.signal }),
        ]);
        if (!mapRes.ok || !eqRes.ok) throw new Error('Ошибка ответа сервера');
        const [mapData, eqData] = await Promise.all([mapRes.json(), eqRes.json()]);

        // plan_url может быть относительным — дополняем базой
        if (mapData.plan_url && !mapData.plan_url.startsWith('http')) {
          mapData.plan_url = `${API_BASE}${mapData.plan_url}`;
        }

        setMap(mapData);
        setEquipment(eqData);

        if (layoutRes.ok) {
          const layoutData = await layoutRes.json();
          setSavedLayout(layoutData);
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        // бекенд ещё не готов — используем мок
        setMap(MOCK_MAP);
        setEquipment(MOCK_EQUIPMENT);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [apiPrefix]);

  return { map, equipment, savedLayout, loading, error };
}
