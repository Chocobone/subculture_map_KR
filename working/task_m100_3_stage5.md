# Stage 5 완료 보고서 — M100 #3: CDK CrawlerStack 구현

## 완료 일시

2026-06-01

## 생성/수정 파일 목록

| 파일 | 변경 | 설명 |
|------|------|------|
| `infra/lib/stacks/crawler-stack.ts` | 신규 | SQS + DLQ + Lambda + EventBridge |
| `infra/lib/stacks/data-stack.ts` | 수정 | `rawTable` (crawler-raw-items) 추가 |
| `infra/bin/app.ts` | 수정 | CrawlerStack 인스턴스 추가 |

## CrawlerStack 리소스

| 리소스 | 설명 |
|--------|------|
| SQS CrawlerQueue | 크롤러 작업 큐, visibilityTimeout 120초 |
| SQS CrawlerDLQ | 3회 실패 시 격리, 보관 14일 |
| Lambda CrawlerWorker | 1024MB, 120초 타임아웃, ARM64 |
| EventBridge Rule | 매 1시간마다 SQS 메시지 발행 |
| DynamoDB rawTable | crawler-raw-items-{env} (data-stack에 추가) |

## CDK synth 결과

```
Successfully synthesized to infra/cdk.out
스택: SubcultureTracker-Data-dev, SubcultureTracker-Api-dev, SubcultureTracker-Crawler-dev
```

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| `cdk synth` 오류 없음 | ✅ |
| 3개 스택 생성 확인 | ✅ |
