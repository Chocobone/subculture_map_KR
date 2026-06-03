# 수행 계획서 — M100 #6: 프론트엔드 SPA 구현

## 1. 목표

React SPA를 구현하여 사용자가 서브컬처 팝업스토어 행사를 지도·목록·캘린더로 탐색하고 관심 IP를 등록·관리할 수 있게 한다.

참고 UI: [거지맵](https://xn--v69ak0xskm.com/) — 지도 기반 탐색, 하단 탭바, 목록 피드 구조
제외 요소: 광고, 상단 바, 심판대, 하단 바의 응모·상점 아이콘

---

## 2. 범위

### 포함
- **프로젝트 초기화**: Vite + React 18 + TypeScript, Tailwind CSS, React Router v6, TanStack Query
- **Mock API**: MSW(Mock Service Worker) — AWS 없이 로컬 완전 구동
- **화면 5종**: 지도, 목록, 신규, MY, 행사 상세
- **공통 컴포넌트**: 하단 탭바, 행사 카드, IP 필터 칩, 상태 배지, 지도 핀 팝업
- **Naver Maps SDK v3**: 팝업스토어 핀 지도 표시
- **Cognito 인증**: 로컬에서는 Mock JWT, 배포 시 실제 Cognito 연동

### 제외
- CloudFront/S3 배포 — 별도 이슈
- 실시간 WebSocket 알림 — 별도 이슈
- 관리자 화면 — 별도 이슈

---

## 3. 화면 구성

| 탭 | 경로 | 핵심 기능 |
|----|------|-----------|
| 지도 | `/` | Naver Maps + 행사 핀, 카테고리 필터, 핀 클릭 바텀시트 |
| 목록 | `/list` | 행사 카드 피드, 상태 탭(진행중/예정/전체), IP 필터 칩 |
| 신규 | `/new` | 최근 7일 신규 등록, D-3 이하 종료 임박 강조 |
| MY | `/my` | 관심 IP 추가·삭제, 알림 토글, 로그인/로그아웃 |
| 상세 | `/events/:id` | 행사 전체 정보, 네이버 지도 미니맵, 출처 링크 |

---

## 4. 핵심 설계 결정

### 4-1. Mock API (MSW)
AWS API Gateway 없이 로컬에서 완전한 UI 동작 테스트.
`frontend/src/mocks/` — 핸들러 정의, `browser.ts` — ServiceWorker 설정.
샘플 데이터: 행사 10건, IP 5개.

### 4-2. Naver Maps SDK
`index.html`에 SDK 스크립트 태그 삽입 + `VITE_NAVER_MAP_CLIENT_ID` 환경변수.
타입 선언: `src/types/naver-maps.d.ts` (커스텀 타입 정의).
로컬에서는 지도 로드 실패 시 목록 폴백 UI 표시.

### 4-3. 인증 처리
`useAuth` 훅에서 `VITE_AUTH_BYPASS=true` 환경변수 확인 시 Mock 사용자 반환.
배포 환경에서는 AWS Amplify `fetchAuthSession()` 사용.

### 4-4. 디렉토리 구조
`frontend/CLAUDE.md` 명세 준수:
```
frontend/src/
├── app/          ← 라우터·프로바이더
├── features/     ← events, ips, map (피처별 분리)
├── shared/       ← api client, 공용 컴포넌트, 훅
└── mocks/        ← MSW 핸들러 + 샘플 데이터
```

---

## 5. 구현 단계 (구현 계획서에서 상세화)

1. 프로젝트 초기화 — Vite scaffold, 의존성 설치, Mock API(MSW) 세팅
2. 공통 컴포넌트 — BottomTabBar, EventCard, StatusBadge, FilterChip
3. 목록·신규 화면 — EventFeed, 필터 동작, TanStack Query 연동
4. 지도 화면 — Naver Maps 초기화, 행사 핀, 바텀시트
5. MY·상세 화면 — IP 관리, 행사 상세, Mock 인증
6. 전체 통합 + 로컬 테스트 완료 보고

---

## 6. 완료 기준

- `npm run dev` 실행 시 5개 화면 모두 Mock 데이터로 정상 렌더링
- `npm run typecheck` 오류 없음
- `npm run lint` 오류 없음
- 하단 탭바 라우팅 정상 동작

---

## 7. 작업지시자 승인 요청

위 계획으로 진행해도 될까요?

**확인 요청 사항**:
1. **Naver Maps Client ID**: `VITE_NAVER_MAP_CLIENT_ID` 환경변수 값 확인 필요 (없으면 지도 로드 불가, 목록 폴백으로 대체)
2. **인증 우선순위**: 로컬 개발 중 Cognito 완전 우회(`VITE_AUTH_BYPASS=true`)로 진행해도 될까요?
3. **Tailwind 버전**: v3 vs v4 — v3으로 진행할까요?
