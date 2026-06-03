import { useState } from 'react';
import { useIPs, useCreateIP, useDeleteIP } from '@/features/ips/hooks/useIPs';
import { useAuth } from '@/shared/hooks/useAuth';

export default function MyPage() {
  const { user }   = useAuth();
  const { data: ips, isLoading } = useIPs();
  const createIP = useCreateIP();
  const deleteIP = useDeleteIP();

  const [showModal, setShowModal] = useState(false);
  const [name,      setName]      = useState('');
  const [keywords,  setKeywords]  = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    createIP.mutate({
      name:     name.trim(),
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
    });
    setName(''); setKeywords(''); setShowModal(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <div>
          <h1 className="text-base font-bold text-gray-900">MY</h1>
          {user && <p className="text-xs text-gray-400">{user.email}</p>}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
        >
          + IP 추가
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading && <p className="text-center text-gray-400 py-10">불러오는 중...</p>}
        {!isLoading && !ips?.length && (
          <p className="text-center text-gray-400 py-10">관심 IP를 추가해 보세요.</p>
        )}
        {ips?.map(ip => (
          <div key={ip.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gray-900">{ip.name}</p>
              <p className="text-xs text-gray-400">{ip.keywords.join(' · ')}</p>
            </div>
            <button
              onClick={() => deleteIP.mutate(ip.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      {/* IP 추가 모달 */}
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-white p-5 space-y-3">
            <h2 className="text-base font-bold">관심 IP 추가</h2>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-primary"
              placeholder="IP 이름 (예: 원피스)"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-primary"
              placeholder="검색 키워드 (쉼표 구분, 예: 원피스,OP)"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-white"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
