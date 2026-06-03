# 구현 계획서 — M100 #6: 프론트엔드 SPA 구현

## 전제 조건
- 수행 계획서 `task_m100_6.md` 승인 완료
- `VITE_NAVER_MAP_CLIENT_ID=neTZb8ckeWDdbD10RRni` (backend/api/.env.example의 NAVER_CLIENT_ID 사용)
- `VITE_AUTH_BYPASS=true` (로컬 Cognito 우회)
- Tailwind CSS v3

---

## Stage 1 — 프로젝트 초기화 + MSW Mock API

**생성 파일**:
- `frontend/package.json`, `vite.config.ts`, `tsconfig.json`
- `frontend/tailwind.config.ts`, `frontend/postcss.config.js`
- `frontend/index.html`
- `frontend/src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`, `src/app/providers.tsx`
- `frontend/src/mocks/data.ts` — 샘플 행사 10건·IP 5개
- `frontend/src/mocks/handlers.ts` — MSW API 핸들러 (`/events`, `/ips`)
- `frontend/src/mocks/browser.ts` — MSW ServiceWorker 등록
- `frontend/src/shared/api/client.ts` — axios 인스턴스
- `frontend/.env.example`, `frontend/.env.local`

**완료 기준**: `npm run dev` 실행 → 화면 뜨고 콘솔 오류 없음

---

## Stage 2 — 공통 컴포넌트

**생성 파일**:
- `frontend/src/shared/components/layout/AppShell.tsx` — 라우터 아웃렛 + 하단 탭바
- `frontend/src/shared/components/layout/BottomTabBar.tsx` — 지도·목록·신규·MY 4탭
- `frontend/src/shared/components/ui/StatusBadge.tsx` — 진행중/예정/종료 배지
- `frontend/src/shared/components/ui/FilterChip.tsx` — IP 필터 칩
- `frontend/src/features/events/components/EventCard.tsx` — 행사 카드

**완료 기준**: `npm run typecheck` 오류 없음, 각 컴포넌트 렌더링 확인

---

## Stage 3 — 목록·신규 화면

**생성 파일**:
- `frontend/src/features/events/hooks/useEvents.ts` — TanStack Query
- `frontend/src/features/events/components/EventFeed.tsx` — 카드 목록
- `frontend/src/features/events/components/StatusTabBar.tsx` — 상태 탭
- `frontend/src/pages/ListPage.tsx` — 목록 화면
- `frontend/src/pages/NewPage.tsx` — 신규 화면

**완료 기준**: Mock 데이터로 행사 카드 목록 렌더링, IP 필터·상태 탭 동작

---

## Stage 4 — 지도 화면

**생성 파일**:
- `frontend/src/types/naver-maps.d.ts` — Naver Maps 타입 선언
- `frontend/src/features/map/hooks/useNaverMap.ts` — 지도 초기화 훅
- `frontend/src/features/map/components/MapView.tsx` — 지도 컨테이너
- `frontend/src/features/map/components/EventBottomSheet.tsx` — 핀 클릭 바텀시트
- `frontend/src/pages/MapPage.tsx`
- `frontend/index.html` 수정 — Naver Maps SDK 스크립트 삽입

**완료 기준**: 지도 로드 + 행사 핀 표시 + 핀 클릭 바텀시트 동작

---

## Stage 5 — MY·행사 상세 화면

**생성 파일**:
- `frontend/src/shared/hooks/useAuth.ts` — Mock 인증 (VITE_AUTH_BYPASS)
- `frontend/src/features/ips/hooks/useIPs.ts`
- `frontend/src/features/ips/components/IPCard.tsx`
- `frontend/src/features/ips/components/IPAddModal.tsx`
- `frontend/src/pages/MyPage.tsx`
- `frontend/src/pages/EventDetailPage.tsx`

**완료 기준**: IP 추가·삭제 동작, 행사 상세 전체 정보 렌더링

---

## Stage 6 — 통합 테스트 + 최종 검증

**작업**:
- `npm run typecheck` 오류 없음
- `npm run lint` 오류 없음
- `npm run dev` — 5개 화면 전체 정상 동작 확인
- 하단 탭바 라우팅, 필터, 카드 클릭 → 상세 흐름 검증

---

## 파일 변경 요약

| 경로 | 작업 | 단계 |
|------|------|------|
| `frontend/package.json` 외 설정 파일 | 신규 | S1 |
| `frontend/src/mocks/` | 신규 | S1 |
| `frontend/src/shared/components/layout/` | 신규 | S2 |
| `frontend/src/shared/components/ui/` | 신규 | S2 |
| `frontend/src/features/events/components/EventCard.tsx` | 신규 | S2 |
| `frontend/src/features/events/` | 신규 | S3 |
| `frontend/src/pages/ListPage.tsx`, `NewPage.tsx` | 신규 | S3 |
| `frontend/src/features/map/` | 신규 | S4 |
| `frontend/src/pages/MapPage.tsx` | 신규 | S4 |
| `frontend/src/features/ips/` | 신규 | S5 |
| `frontend/src/pages/MyPage.tsx`, `EventDetailPage.tsx` | 신규 | S5 |
