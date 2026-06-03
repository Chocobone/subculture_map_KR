# Issue #4 클로즈 노트 — Bedrock 분류기 구현 및 프롬프트 튜닝

## 클로즈 일시
2026-06-03

## 클로즈 사유

Issue #5(Popga.co.kr 크롤러)가 완료되어 아키텍처가 변경됨.

popga.co.kr은 팝업스토어 전문 집계 플랫폼으로 행사명·일정·장소·카테고리가 **이미 구조화**되어 있어 Bedrock AI 분류 없이 Aurora에 직접 저장 가능.

| 항목 | 결정 |
|------|------|
| `BedrockClassifier.ts` 구현 | **취소** |
| `handler.ts` Bedrock 연동 | **취소** (popga 분기만 유지) |
| `002_add_source_url_unique.sql` | **완료** (Issue #5에서 선행 작성) |
| `db/client.ts`, `eventStorage.ts` | **완료** (Issue #5에서 선행 작성) |
| 루리웹 크롤러 Aurora 연동 | **보류** — 루리웹은 rawStorage(DynamoDB) 아카이브 용도로만 유지 |

## 관련 문서 (local/task4 브랜치에 보존)

- `mydocs/plans/task_m100_4.md` — 수행 계획서
- `mydocs/plans/task_m100_4_impl.md` — 구현 계획서 (미실행)
