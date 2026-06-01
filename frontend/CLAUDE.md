# Frontend — Claude Code Guide

React + TypeScript SPA. CloudFront → S3로 배포되는 정적 앱입니다.

> **Hyper-Waterfall 적용**: 컴포넌트 추가·수정 전 수행 계획서를 작성하고 승인을 받아야 합니다.
> 작업 절차: `CLAUDE.md` (루트) → `mydocs/manual/onboarding_guide.md` 참조.

---

## 디렉토리 구조

```
frontend/src/
├── app/
│   ├── App.tsx               ← 라우터 루트
│   ├── providers.tsx         ← QueryClient, Auth, Theme 프로바이더
│   └── routes.tsx            ← 페이지 라우트 정의
├── features/
│   ├── events/               ← 행사 목록·상세·필터
│   │   ├── components/
│   │   │   ├── EventCard.tsx
│   │   │   ├── EventFeed.tsx
│   │   │   └── EventFilter.tsx
│   │   ├── hooks/
│   │   │   ├── useEvents.ts       ← TanStack Query 훅
│   │   │   └── useEventFilter.ts
│   │   └── types.ts
│   ├── ips/                  ← 관심 IP 등록·관리
│   │   ├── components/
│   │   │   ├── IPSidebar.tsx
│   │   │   └── IPAddModal.tsx
│   │   └── hooks/useIPs.ts
│   ├── crawler/              ← 수동 수집 트리거·로그 뷰
│   │   ├── components/
│   │   │   ├── CrawlButton.tsx
│   │   │   └── CrawlLog.tsx
│   │   └── hooks/useCrawlLog.ts
│   └── notifications/        ← 알림 설정
│       └── components/NotificationSettings.tsx
├── shared/
│   ├── api/
│   │   ├── client.ts         ← axios 인스턴스 + 인터셉터
│   │   └── websocket.ts      ← WebSocket 클라이언트
│   ├── components/
│   │   ├── ui/               ← 공용 UI (Button, Badge, Modal 등)
│   │   └── layout/           ← AppShell, Sidebar, Header
│   └── hooks/
│       ├── useAuth.ts        ← Cognito 인증 훅
│       └── useWebSocket.ts   ← 실시간 피드 구독
└── main.tsx
```

---

## 주요 패턴

### API 호출 (TanStack Query)

모든 서버 상태는 TanStack Query로 관리합니다. 컴포넌트에서 직접 `fetch`/`axios`를 호출하지 않습니다.

```typescript
// features/events/hooks/useEvents.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { Event, EventFilter } from '../../../../shared/types';

export const eventKeys = {
  all: ['events'] as const,
  filtered: (filter: EventFilter) => [...eventKeys.all, filter] as const,
};

export function useEvents(filter: EventFilter) {
  return useQuery({
    queryKey: eventKeys.filtered(filter),
    queryFn: () => apiClient.get<Event[]>('/events', { params: filter }),
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });
}
```

### 인증 (Cognito)

```typescript
// shared/api/client.ts — 인터셉터로 JWT 자동 주입
apiClient.interceptors.request.use(async (config) => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### 실시간 피드 (WebSocket)

```typescript
// shared/hooks/useWebSocket.ts
export function useWebSocket(onNewEvent: (event: Event) => void) {
  useEffect(() => {
    const ws = new WebSocket(import.meta.env.VITE_WS_URL);
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'NEW_EVENT') onNewEvent(data.payload);
    };
    return () => ws.close();
  }, []);
}
```

---

## 환경 변수

`.env.local` 파일을 생성해 사용합니다 (`.env.example` 참고):

```bash
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://ws.example.com
VITE_COGNITO_USER_POOL_ID=ap-northeast-2_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_REGION=ap-northeast-2
```

---

## 빌드 및 배포

```bash
npm run dev        # 개발 서버 (localhost:5173)
npm run build      # 프로덕션 빌드 → dist/
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run preview    # 빌드 결과 미리보기
```

S3 배포는 GitHub Actions가 자동으로 처리합니다 (`.github/workflows/deploy-frontend.yml`).

---

## 컴포넌트 작성 규칙

- 파일명: 컴포넌트 `PascalCase.tsx`, 훅 `useCamelCase.ts`
- Props 타입은 컴포넌트 파일 내 `interface Props`로 선언
- 서버 상태 ↔ 클라이언트 상태 혼용 금지 (TanStack Query vs `useState`)
- 공용 UI 컴포넌트는 `shared/components/ui/`에 위치, 피처별 로직 포함 금지
- `shared/types/index.ts`의 공용 타입을 재정의하지 말고 import해서 사용

---

## 새 기능 추가 시 절차 (Hyper-Waterfall)

1. GitHub Issue 등록
2. `mydocs/plans/task_{m}_{N}.md` 수행 계획서 작성 → 승인
3. `mydocs/plans/task_{m}_{N}_impl.md` 구현 계획서 작성 (어느 컴포넌트/훅을 수정할지 명시) → 승인
4. 단계별 구현 → `mydocs/working/task_{m}_{N}_stage{N}.md` 완료 보고 → 승인
5. `mydocs/report/task_{m}_{N}_report.md` 최종 보고 → merge
