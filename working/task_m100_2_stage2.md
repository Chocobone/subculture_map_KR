# Stage 2 완료 보고서 — M100 #2: Lambda API 핸들러 + Naver Local Search API 연동

## 완료 일시

2026-06-01

## 생성 파일 목록 (15개)

| 파일 | 설명 |
|------|------|
| `shared/types/index.ts` | IP, Event, EventFilter, PaginatedResult, CrawlSource 공용 타입 |
| `backend/api/src/utils/response.ts` | `ok()` / `err()` API GW 응답 헬퍼 |
| `backend/api/src/middleware/errorHandler.ts` | `withErrorHandler()` — 핸들러 래퍼, 예외 시 500 반환 |
| `backend/api/src/db/client.ts` | Aurora 연결 풀 (`DB_PASSWORD` 있으면 직접 연결, 없으면 Secrets Manager) |
| `backend/api/src/db/queries/eventQueries.ts` | listEvents, getEventById, insertEvent, deleteEventById |
| `backend/api/src/db/queries/ipQueries.ts` | listIPs, insertIP, deleteIPById |
| `backend/api/src/services/cacheService.ts` | Redis GET/SET/DEL + `scanDel(pattern)` |
| `backend/api/src/services/naverMapsService.ts` | Naver Local Search API 호출 → placeUrl, placeLat, placeLng 반환 |
| `backend/api/src/services/eventService.ts` | list, get, create(Naver 연동 포함), remove |
| `backend/api/src/services/ipService.ts` | list, create, remove |
| `backend/api/src/handlers/events/getEvents.ts` | GET /events (필터 + 페이지네이션) |
| `backend/api/src/handlers/events/getEvent.ts` | GET /events/{id} |
| `backend/api/src/handlers/events/createEvent.ts` | POST /events (필수 필드 검증 + Naver API) |
| `backend/api/src/handlers/events/deleteEvent.ts` | DELETE /events/{id} |
| `backend/api/src/handlers/ips/getIPs.ts` | GET /ips |
| `backend/api/src/handlers/ips/createIP.ts` | POST /ips |
| `backend/api/src/handlers/ips/deleteIP.ts` | DELETE /ips/{id} |
| `backend/api/src/__tests__/naverMapsService.test.ts` | 단위 테스트 4개 |
| `backend/api/src/__tests__/eventQueries.test.ts` | 단위 테스트 5개 |

## 주요 설계 결정

### Naver API 인증 우선순위

```
1순위: NAVER_CLIENT_ID + NAVER_CLIENT_SECRET 환경 변수 (로컬/SAM Local)
2순위: NAVER_SECRET_ARN → Secrets Manager (AWS Lambda)
없으면: place_url, place_lat, place_lng 모두 NULL 저장 (행사 생성은 정상 진행)
```

### 캐시 무효화 방식

`KEYS` 대신 `SCAN` 방식으로 `events:*` 패턴 삭제. 운영 Redis에서 블로킹 없이 동작.

### DB 연결 분기

| 환경 | 동작 |
|------|------|
| 로컬 (Docker) | `DB_PASSWORD` 환경 변수로 직접 연결 |
| AWS Lambda | `DB_SECRET_ARN`으로 Secrets Manager 호출 후 연결 |

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| shared/types 정의 | ✅ |
| 핸들러 7개 구현 | ✅ |
| naverMapsService 구현 (좌표 변환 포함) | ✅ |
| eventService.create에서 Naver API 연동 | ✅ |
| 필수 필드 누락 시 400 반환 | ✅ |
| 단위 테스트 작성 (naverMapsService 4개, eventQueries 5개) | ✅ |
| TypeScript 타입 일관성 | ✅ |
| `npm run test` | ⚠️ Node.js 미설치로 로컬 실행 불가 — 작업지시자 직접 실행 필요 |

## 테스트 실행 방법 (Node.js 설치 후)

```bash
cd backend/api
npm install
npm run test
```

## 다음 단계

Stage 3 — CDK ApiStack에 Lambda 함수 등록 (`data-stack.ts`, `api-stack.ts`)

승인 후 진행하겠습니다.
