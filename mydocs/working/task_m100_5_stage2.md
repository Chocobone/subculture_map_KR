# Stage 2 완료 보고서 — M100 #5: naverMapsService 이식 + shared/types + crawlerFactory

## 완료 일시
2026-06-03

## 작업 내용

### 생성/수정된 파일
- `backend/crawler/src/utils/naverMapsService.ts` — 신규 (api 패키지 패턴 복사)
- `shared/types/index.ts` — `CrawlSource`에 `'popga'` 추가
- `backend/crawler/src/crawlers/crawlerFactory.ts` — `'popga'` 케이스 추가
- `backend/crawler/package.json` — `@aws-sdk/client-secrets-manager` 의존성 추가

### 구현 사항

**naverMapsService.ts**:
- `searchPlace(placeName)` — Naver Local Search API 호출, `PlaceInfo` 반환
- 크리덴셜: `NAVER_CLIENT_ID/NAVER_CLIENT_SECRET` (로컬) 또는 `NAVER_SECRET_ARN` (AWS)
- Lambda 컨테이너 수명 동안 크리덴셜 캐시
- `placeUrl` 빈 문자열 → `null` 처리 (api 패키지 P3 백로그 반영)

**shared/types/index.ts**:
```typescript
// 변경 전
export type CrawlSource = 'ruliweb' | 'fmkorea' | 'twitter' | 'naver-cafe' | 'dcinside';
// 변경 후
export type CrawlSource = 'ruliweb' | 'fmkorea' | 'twitter' | 'naver-cafe' | 'dcinside' | 'popga';
```

**crawlerFactory.ts**:
- `case 'popga': return new PopgaCrawler();` 추가

### 검증 결과

```
TypeScript tsc --noEmit: 오류 없음 ✅
```

## 다음 단계

Stage 3: db/client.ts + eventStorage.ts + handler.ts + 마이그레이션 SQL
