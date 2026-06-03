import { useState } from 'react';
import { useIPs } from '@/features/ips/hooks/useIPs';
import { useEvents } from '@/features/events/hooks/useEvents';
import { EventCard } from '@/features/events/components/EventCard';
import { FilterChip } from '@/shared/components/ui/FilterChip';
import type { EventStatus } from '@shared/types';

const STATUS_TABS: { value: EventStatus | ''; label: string }[] = [
  { value: '',         label: '전체' },
  { value: 'ongoing',  label: '진행중' },
  { value: 'upcoming', label: '예정' },
  { value: 'ended',    label: '종료' },
];

export default function ListPage() {
  const [status, setStatus] = useState<EventStatus | ''>('ongoing');
  const [ipId,   setIpId]   = useState('');

  const { data: ips }    = useIPs();
  const { data, isLoading } = useEvents({
    ...(status ? { status } : {}),
    ...(ipId   ? { ipId }   : {}),
    page: 1, limit: 50,
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {/* 상태 탭 */}
      <div className="flex border-b border-gray-200 bg-white">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              status === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* IP 필터 칩 */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 bg-white border-b border-gray-100">
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

      {/* 행사 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading && <p className="text-center text-gray-400 py-10">불러오는 중...</p>}
        {!isLoading && !data?.items.length && (
          <p className="text-center text-gray-400 py-10">행사가 없습니다.</p>
        )}
        {data?.items.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
