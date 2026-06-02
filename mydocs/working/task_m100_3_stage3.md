# Stage 3 완료 보고서 — M100 #3: rawStorage 구현

## 완료 일시

2026-06-01

## 생성 파일 목록

| 파일 | 설명 |
|------|------|
| `backend/crawler/src/storage/rawStorage.ts` | DynamoDB put + urlHash 중복 체크 |

## DynamoDB 스키마

| 항목 | 값 |
|------|-----|
| 테이블명 | `crawler-raw-items-{env}` |
| PK | `urlHash` (STRING, MD5 of URL) |
| 속성 | `url`, `text`, `source`, `crawledAt`, `ipId` |

## 중복 방지 전략

1. `isDuplicate()`: GetCommand로 urlHash 존재 여부 확인
2. `save()`: ConditionExpression `attribute_not_exists(urlHash)` — 경쟁 조건에서도 안전

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| TypeScript 타입 오류 없음 | ✅ |
