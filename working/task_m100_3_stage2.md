# Stage 2 완료 보고서 — M100 #3: BaseCrawler + RuliwwebCrawler 구현

## 완료 일시

2026-06-01

## 생성 파일 목록

| 파일 | 설명 |
|------|------|
| `backend/crawler/src/crawlers/BaseCrawler.ts` | RawItem 타입 + abstract fetch() + buildSearchQuery() |
| `backend/crawler/src/crawlers/RuliwwebCrawler.ts` | Cheerio HTML 파싱, axios HTTP 요청 |
| `backend/crawler/src/crawlers/crawlerFactory.ts` | CrawlSource → 크롤러 인스턴스 매핑 |
| `backend/crawler/src/utils/dedup.ts` | URL MD5 해시 함수 |

## 루리웹 크롤링 구현 상세

- 검색 URL: `https://bbs.ruliweb.com/search?q={query}&r=content`
- 파싱 셀렉터: `table.board_list_table tbody tr` → `td.subject a.deco`
- 최대 수집: 20건/호출
- 키워드 쿼리: `("원피스" OR "OP") AND (팝업 OR 콜라보 OR 굿즈 OR 한정)` 형식

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| TypeScript 타입 오류 없음 | ✅ |
