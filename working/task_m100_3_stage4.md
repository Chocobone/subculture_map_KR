# Stage 4 완료 보고서 — M100 #3: SQS 핸들러 구현

## 완료 일시

2026-06-01

## 생성 파일 목록

| 파일 | 설명 |
|------|------|
| `backend/crawler/src/handler.ts` | SQSHandler — 메시지 파싱 → 크롤링 → 저장 |

## 처리 흐름

```
SQS Record.body: { ipId, ipName, source, keywords }
  → crawlerFactory(source) → BaseCrawler 인스턴스
  → crawler.fetch(keywords) → RawItem[]
  → 각 item:
      rawStorage.isDuplicate(url)? → skip
      rawStorage.save({ ...item, ipId })
```

## Bedrock 연동 (Issue #4)

현재 핸들러는 원본 수집까지만 담당. Bedrock 분류 및 Aurora upsert는 Issue #4에서 `handler.ts`를 확장한다.

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| TypeScript 타입 오류 없음 | ✅ |
