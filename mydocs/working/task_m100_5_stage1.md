# Stage 1 완료 보고서 — M100 #5: PopgaCrawler.ts + 단위 테스트

## 완료 일시
2026-06-03

## 작업 내용

### 생성된 파일
- `backend/crawler/src/crawlers/PopgaCrawler.ts`
- `backend/crawler/src/__tests__/PopgaCrawler.test.ts`

### 구현 사항

**PopgaCrawler.ts**:
- 사이트맵 파싱: `/sitemap/1.xml` ~ `/sitemap/5.xml` 순회, `lastmod` 30일 필터, URL 중복 제거
- 상세 페이지 파싱: `__NEXT_DATA__` JSON (1차) → Cheerio HTML (폴백) 2단계 파싱
- 카테고리 필터: `애니`, `캐릭터`, `게임` 포함 여부
- 키워드 매칭: IP keywords[]가 title/summary에 포함된 경우만 반환
- REQUEST_DELAY 300ms: 서버 부하 방지
- URL 중복 제거: 동일 팝업이 여러 사이트맵에 등장하는 경우 1회만 처리

**발견 및 수정 사항**:
- 사이트맵 5개를 순회할 때 동일 URL이 중복 수집되는 버그 → `Set<string>` dedup으로 수정

### 테스트 결과

```
Tests: 14 passed, 14 total
- parseSitemap: lastmod 필터, /popup/{id} 패턴 필터 ✅
- parseDetail: __NEXT_DATA__ 파싱, title 없음 → null ✅
- isSubculture: 6개 카테고리 케이스 ✅
- matchesKeywords: 4개 케이스 ✅
- fetch: 통합 흐름 (서브컬처 + 키워드 필터) ✅
```

## 다음 단계

Stage 2: naverMapsService 이식 + shared/types + crawlerFactory
