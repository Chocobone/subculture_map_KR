# 수행 계획서 — M100 #5: Popga.co.kr 크롤러 + Naver Maps 좌표 보강

## 1. 목표

popga.co.kr에서 서브컬처(애니·게임·캐릭터) 팝업스토어 일정을 **직접** 수집한다.

기존 Ruliweb + Bedrock AI 분류 방식은 커뮤니티 게시글을 원본으로 삼아 AI가 행사 정보를 추출하는 구조이다. 반면 popga.co.kr는 팝업스토어 전문 집계 플랫폼으로, 행사명·일정·장소·카테고리가 이미 구조화되어 있다. 이를 1차 소스로 활용하면 Bedrock 호출 없이 신뢰도 높은 행사 데이터를 수집할 수 있다.

```
[기존]  SQS → RuliwwebCrawler → 원본 텍스트 → Bedrock 분류 → Aurora
[신규]  SQS → PopgaCrawler    → 구조화 데이터 → (Naver Maps 좌표) → Aurora
```

루리웹 크롤러는 **삭제하지 않는다**. 두 소스는 병렬 운영한다.

---

## 2. 사전 조사 결과

### 2-1. popga.co.kr 구조 분석

| 항목 | 내용 |
|------|------|
| 기술 스택 | Next.js (SSR + CSR 혼용) |
| 목록 페이지 | `/list/popup` — JavaScript 렌더링, WebFetch 불가 |
| **상세 페이지** | `/popup/{id}` — **SSR, Cheerio 파싱 가능** |
| 사이트맵 | `/sitemap/1.xml` ~ `/sitemap/5.xml` — 팝업 URL + lastmod 제공 |
| ID 규모 | 사이트맵 1개당 약 1,000개 URL (총 5,000개 이상) |
| 상세 데이터 | 팝업명, 시작일, 종료일, 장소명, 주소, 카테고리 확인 |

**상세 페이지 샘플** (`/popup/100`):
- 이름: FC세븐일레븐 with 산리오 팝업
- 기간: 2024-07-19 ~ 2024-08-11
- 장소: 롯데월드몰 B1 아트리움, 서울 송파구 올림픽로 300
- 카테고리: 애니/캐릭터

### 2-2. 수집 전략

- **사이트맵 파싱**: `/sitemap/N.xml`에서 `<loc>` + `<lastmod>` 추출
- **`lastmod` 필터**: 30일 이내 수정된 팝업만 처리 (초기 크롤 폭주 방지)
- **카테고리 화이트리스트**: `애니/캐릭터`, `게임` 카테고리만 Aurora 저장
- **IP 키워드 매칭**: SQS 메시지의 `keywords[]`가 팝업 title/summary에 포함된 경우만 저장

### 2-3. Naver Maps API 활용

기존 `backend/api/src/services/naverMapsService.ts`의 `searchPlace()` 패턴을 크롤러 패키지에 복사하여 place_lat, place_lng, place_url을 보강한다.
- 크리덴셜: `CrawlerStack`에 `dataStack.naverApiSecret` 읽기 권한 추가

---

## 3. 범위

**포함**:
- `PopgaCrawler.ts` — 사이트맵 → 상세 페이지 수집 + 카테고리/키워드 필터
- `backend/crawler/src/utils/naverMapsService.ts` — api 패키지의 서비스 복사 (의존성 분리)
- `shared/types/index.ts` 수정 — `CrawlSource`에 `'popga'` 추가
- `crawlerFactory.ts` 수정 — `'popga'` 케이스 추가
- `handler.ts` 수정 — `source === 'popga'` 분기 추가 (Bedrock 없이 직접 Aurora 저장)
- `infra/lib/stacks/crawler-stack.ts` 수정 — Naver API 시크릿 읽기 권한 추가

**제외**:
- popga.co.kr 로그인/인증 — 공개 페이지만 수집
- 후기 데이터 수집 — 행사 일정만 수집
- 아직 미구현된 Issue #4 (Bedrock/eventStorage)와의 직접 통합 — 본 이슈에서 `eventStorage.upsert()` 독자적으로 활용

---

## 4. 핵심 설계 결정

### 4-1. handler.ts 분기

```typescript
// source별 처리 분기
if (source === 'popga') {
  // 구조화 데이터 — Bedrock 불필요
  const structured: ClassifiedEvent = JSON.parse(raw.text);
  const coords = await naverMapsService.searchPlace(structured.place);
  await eventStorage.upsert({
    ...structured, ipId, sourceUrl: raw.url,
    placeLat: coords?.placeLat ?? null,
    placeLng: coords?.placeLng ?? null,
    placeUrl: coords?.placeUrl ?? null,
  });
} else {
  // Ruliweb 등 — 기존 Bedrock 분류 흐름 (Issue #4에서 구현)
}
```

### 4-2. PopgaCrawler의 RawItem 활용

`RawItem.text` 필드에 `ClassifiedEvent` 직렬화 JSON 저장.
이는 `rawStorage`(DynamoDB)에 원본 그대로 보관하면서도 Bedrock 없이 처리 가능하게 한다.

### 4-3. 사이트맵 활용 이유

- popga.co.kr 목록 페이지는 CSR 렌더링이라 Cheerio 파싱 불가
- 사이트맵은 정적 XML로 모든 팝업 ID와 마지막 수정일 제공
- `lastmod` 필터로 증분 수집 가능 (매 크롤 시 불필요한 요청 최소화)

---

## 5. 구현 단계 (구현 계획서에서 상세화)

1. `PopgaCrawler.ts` 구현 + 단위 테스트 (사이트맵 파싱, 상세 페이지 파싱)
2. `naverMapsService.ts` 크롤러 패키지 이식 + `CrawlerStack` IAM 수정
3. `shared/types`, `crawlerFactory.ts`, `handler.ts` 수정
4. 전체 테스트 + `cdk synth` 검증

---

## 6. 완료 기준

- `npm run test -ws` 전체 통과
- `cdk synth` 오류 없음
- 단위 테스트: 사이트맵 파싱 / 상세 페이지 파싱 / 카테고리 필터 / 키워드 매칭 4개 케이스

---

## 7. 작업지시자 승인 요청

위 계획으로 진행해도 될까요?

**확인 요청 사항**:
1. **handler.ts 분기 방식**: `source === 'popga'` 조건 분기로 Bedrock 없이 처리하는 설계 동의 여부
2. **Issue #4 선행 여부**: Issue #5는 `eventStorage.upsert()` 독자적으로 재구현하므로 Issue #4 완료 전 병렬 진행 가능. 동의 여부
3. **`lastmod` 기준일**: 최초 크롤 시 30일 이내 팝업만 수집하는 방식 동의 여부
