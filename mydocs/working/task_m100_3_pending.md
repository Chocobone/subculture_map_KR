# M100 #3 미완료 항목 — 루리웹 크롤러 구현

> Issue #3 클로즈 후 이관된 미완료 항목 (2026-06-02)
> 원본 보고서: `mydocs/report/task_m100_3_report.md`

---

## 미완료 항목

### P1 — Bedrock 분류기 연동 (Issue #4)

`backend/crawler/src/handler.ts`에 현재 classifier 호출이 없음.
Issue #4(Bedrock 분류기 구현)에서 다음 로직을 추가해야 함:

```typescript
// handler.ts에 추가 예정 (Issue #4)
import { BedrockClassifier } from './classifier/BedrockClassifier';

const classifier = new BedrockClassifier();

// rawStorage.save() 이후
const classified = await classifier.classify(raw.text, ipName);
if (classified) {
  await eventStorage.upsert({ ...classified, ipName, sourceUrl: raw.url });
}
```

**담당 이슈**: Issue #4

### P2 — rawStorage 로컬 엔드포인트 지원 (백로그)

`backend/crawler/src/storage/rawStorage.ts`의 DynamoDB 클라이언트가
`DYNAMO_ENDPOINT` 환경변수를 무시하여 로컬 DynamoDB Local 테스트 불가.

**개선 방향**:

```typescript
// 현재
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// 개선 (DYNAMO_ENDPOINT 지원)
const ddbClient = new DynamoDBClient(
  process.env.DYNAMO_ENDPOINT
    ? { endpoint: process.env.DYNAMO_ENDPOINT }
    : {}
);
const ddb = DynamoDBDocumentClient.from(ddbClient);
```

**우선순위**: 중간 (로컬 통합 테스트 가능 여부에 영향)
**등록**: B-004 백로그

### P3 — 추가 크롤링 소스 미구현

| 소스 | 상태 | 이슈 |
|------|------|------|
| fmkorea (에펨코리아) | 미구현 | 별도 이슈 필요 |
| twitter (Twitter API v2) | 미구현 | 별도 이슈 필요 |
| naver-cafe (네이버 카페) | 미구현 | 별도 이슈 필요 |
| dcinside | 미구현 | 별도 이슈 필요 |

`crawlerFactory.ts`에 각 소스 키는 이미 타입에 정의되어 있으나 실제 Crawler 클래스 없음.
현재 미등록 소스로 메시지 발행 시 `throw new Error('알 수 없는 소스')` 발생.

**우선순위**: M100 범위 외 — M200 이후 단계적 추가

### P4 — dev 환경 통합 테스트 (배포 후)

| 항목 | 내용 |
|------|------|
| EventBridge Rule 동작 | 매 시간 SQS 메시지 발행 확인 |
| SQS → Lambda 트리거 | CloudWatch Logs에서 크롤러 실행 로그 확인 |
| DynamoDB 원본 저장 | `crawler-raw-items-dev` 테이블에 데이터 적재 확인 |
| 중복 URL 필터 | 동일 URL 재수집 시 skip 동작 확인 |

---

## 연관 백로그

- B-004: `rawStorage` DYNAMO_ENDPOINT 로컬 환경변수 지원 추가
- B-003: Twitter API v2 Rate Limit 대응 (429 재시도 로직) — twitter 소스 추가 시 필요
