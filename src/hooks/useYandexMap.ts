import { useEffect, useRef, useCallback, useState } from 'react';

const YMAPS_SRC = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';

let ymapsPromise: Promise<any> | null = null;

/** Загружает Yandex Maps JS API один раз и возвращает глобальный ymaps */
function loadYmaps(apikey: string): Promise<any> {
  if (ymapsPromise) return ymapsPromise;
  ymapsPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).ymaps) {
      (window as any).ymaps.ready(() => resolve((window as any).ymaps));
      return;
    }
    const script = document.createElement('script');
    script.src = `${YMAPS_SRC}&apikey=${apikey}`;
    script.async = true;
    script.onload = () => {
      (window as any).ymaps.ready(() => resolve((window as any).ymaps));
    };
    script.onerror = () => {
      ymapsPromise = null;
      reject(new Error('Failed to load Yandex Maps API'));
    };
    document.head.appendChild(script);
  });
  return ymapsPromise;
}

export interface MapMarker {
  coords: number[];
  label: string;
  selected?: boolean;
}

interface UseYandexMapOptions {
  apikey: string;
  center: number[];
  zoom: number;
  markers?: MapMarker[];
  onMarkerClick?: (label: string) => void;
}

/**
 * Хук для работы с Яндекс Картами напрямую (без @pbe/react-yandex-maps).
 * Возвращает ref для контейнера карты и флаг готовности.
 */
export function useYandexMap({
  apikey,
  center,
  zoom,
  markers = [],
  onMarkerClick,
}: UseYandexMapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;

  // Инициализация карты
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    loadYmaps(apikey).then((ym) => {
      if (destroyed || !containerRef.current) return;
      const map = new ym.Map(containerRef.current, {
        center,
        zoom,
        controls: ['zoomControl'],
      });
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apikey]);

  // Обновление маркеров
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Удалить старые
    markersRef.current.forEach((pm) => map.geoObjects.remove(pm));
    markersRef.current = [];

    markers.forEach((m) => {
      const placemark = new (window as any).ymaps.Placemark(
        m.coords,
        { iconCaption: '?' },
        {
          preset: m.selected ? 'islands#redDotIcon' : 'islands#blueIcon',
          iconColor: m.selected ? '#ef4444' : '#3b82f6',
        },
      );
      placemark.events.add('click', () => {
        onClickRef.current?.(m.label);
      });
      map.geoObjects.add(placemark);
      markersRef.current.push(placemark);
    });
  }, [markers, ready]);

  return { containerRef, ready };
}
