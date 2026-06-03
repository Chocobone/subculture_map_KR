# 최종 결과 보고서 — M100 #5: Popga.co.kr 크롤러 + Naver Maps 좌표 보강

## 완료 일시
2026-06-03

## 브랜치
`local/task5`

---

## 목표 달성 여부

popga.co.kr 전문 크롤러를 구현하여 서브컬처 팝업스토어 데이터를 Bedrock AI 없이 직접 수집·저장하는 파이프라인을 완성했다.

```
[이전]  SQS → RuliwwebCrawler → 원본 텍스트 → (Bedrock 미연동)
[완료]  SQS → PopgaCrawler → 구조화 데이터 → Naver Maps 좌표 → Aurora
```

루리웹 크롤러는 삭제하지 않고 병렬 운영 가능.

---

## 구현 완료 목록

### Stage 1 — PopgaCrawler.ts + 단위 테스트 (14/14)
- **사이트맵 수집**: `/sitemap/1~5.xml` 파싱, `lastmod` 30일 필터, URL 중복 제거
- **상세 페이지 파싱**: `__NEXT_DATA__` JSON(1차) → Cheerio HTML(폴백) 2단계
- **카테고리 필터**: `애니`, `캐릭터`, `게임` 화이트리스트
- **키워드 매칭**: SQS `keywords[]` 기반 IP 필터
- **단위 테스트**: 14개 케이스 전체 통과

### Stage 2 — naverMapsService + shared/types + crawlerFactory
- `backend/crawler/src/utils/naverMapsService.ts` — api 패키지 패턴 복사, `placeUrl` 빈 문자열 → null 개선
- `shared/types/index.ts` — `CrawlSource`에 `'popga'` 추가
- `crawlerFactory.ts` — `'popga'` 케이스 추가

### Stage 3 — db/client + eventStorage + handler + 마이그레이션 SQL
- `backend/crawler/src/db/client.ts` — Pool 싱글턴, Secrets Manager 연동
- `backend/crawler/src/storage/eventStorage.ts` — Aurora upsert(좌표 포함), `fromPlaceInfo()` 헬퍼
- `backend/crawler/src/handler.ts` — `source === 'popga'` 분기 (Bedrock 우회, Naver Maps 좌표 보강)
- `backend/api/src/db/migrations/002_add_source_url_unique.sql` — `source_url` UNIQUE 제약

### Stage 4 — CrawlerStack + cdk synth
- `infra/lib/stacks/crawler-stack.ts` — Aurora/Naver 환경변수 + Secrets Manager 권한 + 5432 인그레스
- `cdk synth SubcultureTracker-Crawler-dev`: 오류 없음 ✅

---

## 생성/수정된 파일 목록

| 파일 | 작업 |
|------|------|
| `backend/crawler/src/crawlers/PopgaCrawler.ts` | 신규 |
| `backend/crawler/src/__tests__/PopgaCrawler.test.ts` | 신규 |
| `backend/crawler/src/utils/naverMapsService.ts` | 신규 |
| `backend/crawler/src/db/client.ts` | 신규 |
| `backend/crawler/src/storage/eventStorage.ts` | 신규 |
| `backend/crawler/src/handler.ts` | 수정 |
| `backend/crawler/src/crawlers/crawlerFactory.ts` | 수정 |
| `backend/crawler/package.json` | 수정 |
| `shared/types/index.ts` | 수정 |
| `backend/api/src/db/migrations/002_add_source_url_unique.sql` | 신규 |
| `infra/lib/stacks/crawler-stack.ts` | 수정 |

---

## 완료 기준 충족

| 기준 | 결과 |
|------|------|
| `npm test` (crawler) 전체 통과 | ✅ 14/14 |
| TypeScript 컴파일 오류 없음 | ✅ |
| `cdk synth SubcultureTracker-Crawler-dev` 오류 없음 | ✅ |
| 루리웹 크롤러 유지 | ✅ |
| Bedrock 미사용 (popga 소스) | ✅ |

---

## 미완료 항목 및 후속 이슈

### Issue #4 연동
- `handler.ts`의 `ruliweb` 소스 분기는 현재 원본 저장만 수행
- Issue #4(Bedrock 분류기)에서 `classifier.classify()` + `eventStorage.upsert()` 연동 예정
- Issue #5에서 생성한 `db/client.ts`와 `eventStorage.ts`는 Issue #4에서 재사용 가능

### 마이그레이션 적용
- `002_add_source_url_unique.sql`은 Aurora 배포 후 수동 적용 필요
- 기존 `source_url` 중복 데이터가 있으면 마이그레이션 전 정리 필요

### Handler 배포 시 Lambda 제한 시간
- PopgaCrawler는 사이트맵 5개 + 각 팝업 상세 페이지를 순회하므로 실행 시간이 길 수 있음
- 현재 Lambda timeout: 120초. IP 1개 기준 최대 ~30개 팝업 처리 예상 (300ms delay × 30 = 9초)

---

## 작업지시자 확인 요청

이슈 #5 완료로 판단해 주시면 merge 절차를 진행하겠습니다.
