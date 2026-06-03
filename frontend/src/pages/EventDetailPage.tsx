import { useParams, useNavigate } from 'react-router-dom';
import { useEvent } from '@/features/events/hooks/useEvents';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';

const TYPE_LABEL = { popup: '팝업', collab: '콜라보', goods: '굿즈', limited: '한정' };

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading } = useEvent(id ?? '');

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-gray-400">불러오는 중...</div>;
  }
  if (!event) {
    return <div className="flex h-full items-center justify-center text-gray-400">행사를 찾을 수 없습니다.</div>;
  }

  const naverMapUrl = event.placeLat && event.placeLng
    ? `https://map.naver.com/v5/search/${encodeURIComponent(event.place ?? '')}`
    : null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {/* 헤더 */}
      <div className="flex items-center gap-3 bg-white px-4 py-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="text-gray-500 text-lg">←</button>
        <h1 className="flex-1 truncate text-sm font-bold text-gray-900">{event.title}</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 타입/상태 배지 */}
        <div className="flex items-center gap-2 bg-white px-4 py-3">
          <StatusBadge status={event.status} />
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {TYPE_LABEL[event.type]}
          </span>
        </div>

        {/* 정보 카드 */}
        <div className="mx-4 mt-3 rounded-xl bg-white p-4 shadow-sm space-y-3">
          <InfoRow label="행사명" value={event.title} />
          <InfoRow label="장소"   value={event.place ?? '-'} />
          <InfoRow
            label="기간"
            value={event.startDate && event.endDate
              ? `${event.startDate} ~ ${event.endDate}`
              : '-'}
          />
          {event.summary && <InfoRow label="요약" value={event.summary} />}
        </div>

        {/* 지도 링크 */}
        {naverMapUrl && (
          <div className="mx-4 mt-3">
            <a
              href={naverMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-sm font-medium text-white"
            >
              🗺️ 네이버 지도로 길찾기
            </a>
          </div>
        )}

        {/* 출처 */}
        {event.sourceUrl && (
          <div className="mx-4 mt-3 mb-6">
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm text-gray-500"
            >
              원문 보기 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-14 shrink-0 text-xs text-gray-400">{label}</span>
      <span className="flex-1 text-sm text-gray-900">{value}</span>
    </div>
  );
}
