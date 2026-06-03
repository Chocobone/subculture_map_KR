# 구현 계획서 — M100 #5: Popga.co.kr 크롤러 + Naver Maps 좌표 보강

## 전제 조건

수행 계획서 `task_m100_5.md` 승인 완료. `local/task5` 브랜치에서 작업.

---

## 단계별 구현 계획

### Stage 1 — PopgaCrawler.ts 구현 + 단위 테스트

**생성/수정 파일**:
- `backend/crawler/src/crawlers/PopgaCrawler.ts` — 신규
- `backend/crawler/src/__tests__/PopgaCrawler.test.ts` — 신규

**구현 내용**:

1. **사이트맵 파싱** (`/sitemap/N.xml`, N=1~5)
   - `<loc>`, `<lastmod>` 정규식 추출
   - `/popup/{id}` 형식만 선별
   - `lastmod` 30일 필터 적용

2. **상세 페이지 파싱** (`/popup/{id}`)
   - 1차: `<script id="__NEXT_DATA__">` JSON 파싱
   - 2차(폴백): Cheerio HTML 파싱 (날짜 패턴 regex, 제목 h1/h2)
   - 추출 필드: title, startDate, endDate, place, address, category, summary

3. **필터링**
   - 카테고리 화이트리스트: `애니`, `캐릭터`, `게임` 포함 여부
   - IP 키워드 매칭: `keywords[]` 중 하나가 title/summary에 포함

4. **RawItem 반환**
   - `text` 필드: `ClassifiedEvent` 직렬화 JSON
   - `source`: `'popga'`

**단위 테스트** (4개 케이스):
- 사이트맵 파싱: lastmod 필터 적용 확인
- 상세 페이지 파싱: `__NEXT_DATA__` 정상 파싱
- 카테고리 필터: 비서브컬처 팝업 제외 확인
- 키워드 매칭: keywords 미포함 팝업 제외 확인

**완료 기준**: `npm test` 전체 통과

---

### Stage 2 — naverMapsService 이식 + shared/types + crawlerFactory

**생성/수정 파일**:
- `backend/crawler/src/utils/naverMapsService.ts` — 신규 (api 패키지 패턴 복사)
- `shared/types/index.ts` — `CrawlSource`에 `'popga'` 추가
- `backend/crawler/src/crawlers/crawlerFactory.ts` — `'popga'` 케이스 추가
- `backend/crawler/package.json` — `@aws-sdk/client-secrets-manager` 의존성 추가

**구현 내용**:

```typescript
// naverMapsService.ts — api 패키지와 동일 구조
// 크리덴셜: NAVER_SECRET_ARN(AWS) 또는 NAVER_CLIENT_ID/NAVER_CLIENT_SECRET(로컬)
export async function searchPlace(placeName: string): Promise<PlaceInfo | null>
```

**완료 기준**: TypeScript 컴파일 오류 없음

---

### Stage 3 — db/client.ts + eventStorage.ts + handler.ts + 마이그레이션 SQL

**생성/수정 파일**:
- `backend/crawler/src/db/client.ts` — 신규 (api 패키지 패턴 복사)
- `backend/crawler/src/storage/eventStorage.ts` — 신규
- `backend/crawler/src/handler.ts` — 수정 (popga 소스 분기 추가)
- `backend/api/src/db/migrations/002_add_source_url_unique.sql` — 신규
- `backend/crawler/package.json` — `pg` 의존성 추가

**`eventStorage.ts` upsert SQL**:
```sql
INSERT INTO events (ip_id, title, type, place, place_lat, place_lng, place_url,
                    start_date, end_date, source_url, summary, status)
VALUES ($1,...) ON CONFLICT (source_url) DO UPDATE SET ...
```

**`handler.ts` popga 분기**:
```typescript
if (source === 'popga') {
  const structured = JSON.parse(raw.text) as ClassifiedEvent;
  const coords = await naverMaps.searchPlace(structured.place);
  await eventStorage.upsert({ ...structured, ipId, sourceUrl: raw.url, ...coords });
}
// 그 외 소스(ruliweb 등)는 미래 Issue #4에서 Bedrock 연동
```

**비고**: `db/client.ts`와 `eventStorage.ts`는 Issue #4에서도 동일하게 사용됨.
Issue #4 구현 시 이 파일들은 이미 존재하므로 재사용.

**완료 기준**: `npm test` 전체 통과, 마이그레이션 SQL 문법 검증

---

### Stage 4 — CrawlerStack 수정 + 전체 테스트 + cdk synth

**수정 파일**:
- `infra/lib/stacks/crawler-stack.ts`

**변경 내용**:
```typescript
const { network, rawTable, aurora, dbSecret, naverApiSecret } = dataStack;

// 환경변수 추가
environment: {
  DYNAMO_TABLE:    rawTable.tableName,
  DB_SECRET_ARN:   dbSecret.secretArn,
  DB_HOST:         aurora.clusterEndpoint.hostname,
  DB_NAME:         'subculture_tracker',
  NAVER_SECRET_ARN: naverApiSecret.secretArn,
},

// IAM 권한 추가
dbSecret.grantRead(crawlerFn);
naverApiSecret.grantRead(crawlerFn);
network.dbSg.addIngressRule(network.lambdaSg, Port.tcp(5432), 'Crawler Lambda → Aurora');
```

**검증**:
- `npm run test -ws` 전체 통과
- `cd infra && npx cdk synth --all --context env=dev` 오류 없음

**완료 기준**: 위 두 명령 모두 통과

---

## 파일 변경 요약

| 파일 | 작업 | 단계 |
|------|------|------|
| `backend/crawler/src/crawlers/PopgaCrawler.ts` | 신규 | Stage 1 |
| `backend/crawler/src/__tests__/PopgaCrawler.test.ts` | 신규 | Stage 1 |
| `backend/crawler/src/utils/naverMapsService.ts` | 신규 | Stage 2 |
| `shared/types/index.ts` | 수정 | Stage 2 |
| `backend/crawler/src/crawlers/crawlerFactory.ts` | 수정 | Stage 2 |
| `backend/crawler/package.json` | 수정 | Stage 2, 3 |
| `backend/crawler/src/db/client.ts` | 신규 | Stage 3 |
| `backend/crawler/src/storage/eventStorage.ts` | 신규 | Stage 3 |
| `backend/crawler/src/handler.ts` | 수정 | Stage 3 |
| `backend/api/src/db/migrations/002_add_source_url_unique.sql` | 신규 | Stage 3 |
| `infra/lib/stacks/crawler-stack.ts` | 수정 | Stage 4 |
