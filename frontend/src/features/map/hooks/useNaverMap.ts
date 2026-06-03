import { useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 }; // 서울 시청
const DEFAULT_ZOOM   = 12;

export function useNaverMap(containerRef: React.RefObject<HTMLDivElement>) {
  const mapRef     = useRef<naver.maps.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Naver Maps SDK 로드 확인
    if (typeof naver === 'undefined' || !naver?.maps?.Map) {
      setError(true);
      return;
    }

    try {
      mapRef.current = new naver.maps.Map(containerRef.current, {
        center:  new naver.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
        zoom:    DEFAULT_ZOOM,
        minZoom: 7,
        maxZoom: 19,
      });
      setReady(true);
    } catch {
      setError(true);
    }
  }, [containerRef]);

  return { map: mapRef.current, ready, error };
}
