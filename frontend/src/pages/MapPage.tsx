import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '@/features/events/hooks/useEvents';
import { useIPs } from '@/features/ips/hooks/useIPs';
import { useNaverMap } from '@/features/map/hooks/useNaverMap';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';
import { FilterChip } from '@/shared/components/ui/FilterChip';
import type { Event } from '@shared/types';

const TYPE_EMOJI: Record<Event['type'], string> = {
  popup: '🏪', collab: '🤝', goods: '🎁', limited: '⭐',
};

export default function MapPage() {
  const navigate  = useNavigate();
  const mapEl     = useRef<HTMLDivElement>(null);
  const { map, ready, error } = useNaverMap(mapEl);

  const [ipId,     setIpId]     = useState('');
  const [selected, setSelected] = useState<Event | null>(null);

  const { data: ips }    = useIPs();
  const { data: events } = useEvents({ page: 1, limit: 200 });

  // 지도에 핀 렌더링
  useEffect(() => {
    if (!ready || !map || !events?.items) return;

    const markers: naver.maps.Marker[] = [];
    const filtered = ipId
      ? events.items.filter(e => e.ipId === ipId)
      : events.items;

    filtered.forEach(event => {
      if (!event.placeLat || !event.placeLng) return;

      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(event.placeLat, event.placeLng),
        map,
        title: event.title,
      });
      marker.addListener('click', () => setSelected(event));
      markers.push(marker);
    });

    return () => markers.forEach(m => m.setMap(null));
  }, [ready, map, events, ipId]);

  // 지도 SDK 로드 실패 시 목록 폴백
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-gray-50 px-6">
        <span className="text-4xl">🗺️</span>
        <p className="text-center text-sm text-gray-500">
          지도를 불러올 수 없습니다.<br />
          목록 탭에서 행사를 확인하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* IP 필터 */}
      <div className="absolute top-3 left-0 right-0 z-10 flex gap-2 overflow-x-auto px-4">
        <FilterChip label="전체" active={!ipId} onClick={() => setIpId('')} />
        {ips?.map(ip => (
          <FilterChip
            key={ip.id}
            label={ip.name}
            active={ipId === ip.id}
            onClick={() => setIpId(ipId === ip.id ? '' : ip.id)}
          />
        ))}
      </div>

      {/* 지도 컨테이너 */}
      <div ref={mapEl} className="flex-1 w-full" />

      {/* 핀 클릭 바텀시트 */}
      {selected && (
        <div className="absolute bottom-0 left-0 right-0 z-20 rounded-t-2xl bg-white p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{TYPE_EMOJI[selected.type]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <StatusBadge status={selected.status} />
              </div>
              <p className="text-sm font-semibold text-gray-900 truncate">{selected.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{selected.place}</p>
              {selected.startDate && selected.endDate && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {selected.startDate} ~ {selected.endDate}
                </p>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-300 text-xl leading-none">✕</button>
          </div>
          <button
            onClick={() => navigate(`/events/${selected.id}`)}
            className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-medium text-white"
          >
            상세 보기
          </button>
        </div>
      )}
    </div>
  );
}
