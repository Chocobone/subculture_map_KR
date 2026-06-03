import type { Event, IP } from '@shared/types';

export const mockIPs: IP[] = [
  { id: 'ip-1', name: '원피스', keywords: ['원피스', 'One Piece', 'OP'], createdAt: '2026-01-01T00:00:00Z' },
  { id: 'ip-2', name: '주술회전', keywords: ['주술회전', '고죠사토루'], createdAt: '2026-01-02T00:00:00Z' },
  { id: 'ip-3', name: '블루아카이브', keywords: ['블루아카이브', '블아'], createdAt: '2026-01-03T00:00:00Z' },
  { id: 'ip-4', name: '스파이패밀리', keywords: ['스파이패밀리', 'SPY×FAMILY'], createdAt: '2026-01-04T00:00:00Z' },
  { id: 'ip-5', name: '포켓몬', keywords: ['포켓몬', 'Pokemon'], createdAt: '2026-01-05T00:00:00Z' },
];

const now = new Date('2026-06-03');
const d = (offset: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const mockEvents: Event[] = [
  {
    id: 'ev-1', ipId: 'ip-1',
    title: '원피스 25주년 팝업스토어',
    type: 'popup', place: '스타필드 코엑스몰 B1',
    placeUrl: null, placeLat: 37.5115, placeLng: 127.0595,
    startDate: d(-5), endDate: d(10),
    sourceUrl: 'https://popga.co.kr/popup/1001',
    status: 'ongoing', summary: '루피·조로·나미 등 주요 캐릭터 굿즈 한정 판매',
    createdAt: d(-10) + 'T00:00:00Z', updatedAt: d(-5) + 'T00:00:00Z',
  },
  {
    id: 'ev-2', ipId: 'ip-2',
    title: '주술회전 콜라보 카페',
    type: 'collab', place: '홍대 무신사 테라스',
    placeUrl: null, placeLat: 37.5563, placeLng: 126.9233,
    startDate: d(3), endDate: d(20),
    sourceUrl: 'https://popga.co.kr/popup/1002',
    status: 'upcoming', summary: '고죠·메구미 한정 드링크 메뉴 + 포토카드 증정',
    createdAt: d(-3) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
  },
  {
    id: 'ev-3', ipId: 'ip-3',
    title: '블루아카이브 굿즈샵',
    type: 'goods', place: '아케이드 K 신사점',
    placeUrl: null, placeLat: 37.5241, placeLng: 127.0200,
    startDate: d(-15), endDate: d(-1),
    sourceUrl: 'https://popga.co.kr/popup/1003',
    status: 'ended', summary: '아리우스 분교 한정 아크릴 굿즈 세트',
    createdAt: d(-20) + 'T00:00:00Z', updatedAt: d(-15) + 'T00:00:00Z',
  },
  {
    id: 'ev-4', ipId: 'ip-4',
    title: '스파이패밀리 팝업 in 롯데월드',
    type: 'popup', place: '롯데월드몰 1F 아트리움',
    placeUrl: null, placeLat: 37.5110, placeLng: 127.0984,
    startDate: d(0), endDate: d(7),
    sourceUrl: 'https://popga.co.kr/popup/1004',
    status: 'ongoing', summary: '아냐·로이드·요르 캐릭터 포토존 + 한정 굿즈',
    createdAt: d(-5) + 'T00:00:00Z', updatedAt: d(0) + 'T00:00:00Z',
  },
  {
    id: 'ev-5', ipId: 'ip-5',
    title: '포켓몬 한정 팝업스토어',
    type: 'popup', place: '더현대 서울 1F',
    placeUrl: null, placeLat: 37.5257, placeLng: 126.9269,
    startDate: d(7), endDate: d(21),
    sourceUrl: 'https://popga.co.kr/popup/1005',
    status: 'upcoming', summary: '이번주 공개 신규 포켓몬 굿즈 선공개',
    createdAt: d(-1) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
  },
  {
    id: 'ev-6', ipId: 'ip-1',
    title: '원피스 필름 RED 콜라보 전시',
    type: 'limited', place: '동대문디자인플라자 D홀',
    placeUrl: null, placeLat: 37.5671, placeLng: 127.0096,
    startDate: d(1), endDate: d(4),
    sourceUrl: 'https://popga.co.kr/popup/1006',
    status: 'upcoming', summary: 'FILM RED 오리지널 일러스트 전시 + 한정 프린트',
    createdAt: d(-2) + 'T00:00:00Z', updatedAt: d(-2) + 'T00:00:00Z',
  },
  {
    id: 'ev-7', ipId: 'ip-2',
    title: '주술회전 한정 굿즈 판매',
    type: 'goods', place: '건대 커먼그라운드',
    placeUrl: null, placeLat: 37.5397, placeLng: 127.0696,
    startDate: d(-20), endDate: d(-10),
    sourceUrl: 'https://popga.co.kr/popup/1007',
    status: 'ended', summary: '오쿠타후 한정 키링·엽서 세트',
    createdAt: d(-25) + 'T00:00:00Z', updatedAt: d(-20) + 'T00:00:00Z',
  },
  {
    id: 'ev-8', ipId: 'ip-3',
    title: '블루아카이브 x 편의점 콜라보',
    type: 'collab', place: '전국 세븐일레븐',
    placeUrl: null, placeLat: 37.5665, placeLng: 126.9780,
    startDate: d(-3), endDate: d(14),
    sourceUrl: 'https://popga.co.kr/popup/1008',
    status: 'ongoing', summary: '캐릭터 도시락·음료 한정 출시',
    createdAt: d(-5) + 'T00:00:00Z', updatedAt: d(-3) + 'T00:00:00Z',
  },
  {
    id: 'ev-9', ipId: 'ip-4',
    title: '스파이패밀리 카페 콜라보',
    type: 'collab', place: '신촌 카페 봄',
    placeUrl: null, placeLat: 37.5590, placeLng: 126.9368,
    startDate: d(2), endDate: d(16),
    sourceUrl: 'https://popga.co.kr/popup/1009',
    status: 'upcoming', summary: '아냐 인증샷 도장깨기 이벤트',
    createdAt: d(-1) + 'T00:00:00Z', updatedAt: d(-1) + 'T00:00:00Z',
  },
  {
    id: 'ev-10', ipId: 'ip-5',
    title: '포켓몬 카드 한정 발매 이벤트',
    type: 'goods', place: '용산 아이파크몰 3F',
    placeUrl: null, placeLat: 37.5295, placeLng: 126.9649,
    startDate: d(-2), endDate: d(2),
    sourceUrl: 'https://popga.co.kr/popup/1010',
    status: 'ongoing', summary: '신규 확장팩 선행 발매 + 추첨 이벤트',
    createdAt: d(-4) + 'T00:00:00Z', updatedAt: d(-2) + 'T00:00:00Z',
  },
];
