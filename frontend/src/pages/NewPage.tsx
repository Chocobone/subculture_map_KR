import { useEvents } from '@/features/events/hooks/useEvents';
import { EventCard } from '@/features/events/components/EventCard';

export default function NewPage() {
  const { data, isLoading } = useEvents({ page: 1, limit: 50 });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const newItems = data?.items.filter(e => {
    if (!e.createdAt) return false;
    return new Date(e.createdAt) >= sevenDaysAgo && e.status !== 'ended';
  }) ?? [];

  // D-3 이하 종료 임박 항목
  const urgentIds = new Set(
    data?.items.filter(e => {
      if (!e.endDate || e.status !== 'ongoing') return false;
      const diff = Math.ceil((new Date(e.endDate).getTime() - Date.now()) / 86400000);
      return diff >= 0 && diff <= 3;
    }).map(e => e.id) ?? [],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <h1 className="text-base font-bold text-gray-900">신규 팝업</h1>
        <p className="text-xs text-gray-400 mt-0.5">최근 7일 내 등록된 행사</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading && <p className="text-center text-gray-400 py-10">불러오는 중...</p>}
        {!isLoading && !newItems.length && (
          <p className="text-center text-gray-400 py-10">신규 행사가 없습니다.</p>
        )}
        {newItems.map(event => (
          <div key={event.id} className="relative">
            {urgentIds.has(event.id) && (
              <div className="absolute -top-1 -right-1 z-10 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                종료 임박
              </div>
            )}
            <EventCard event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}
