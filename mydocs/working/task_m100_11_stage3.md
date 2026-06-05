# Stage 3 완료 보고서 — Task M100 #11
## api-stack.ts · crawler-stack.ts: logRetention 환경별 분기

> 완료일: 2026-06-05  
> 브랜치: `local/task11`

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `infra/lib/stacks/api-stack.ts` | `RetentionDays` import, `isProd` 선언, `lambdaBase`에 `logRetention` 추가 |
| `infra/lib/stacks/crawler-stack.ts` | `RetentionDays` import, `isProd` 선언, `crawlerFn`에 `logRetention` 추가 |

---

## 상세 변경 내용

### api-stack.ts

```typescript
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

const isProd = envName === 'prod';

const lambdaBase = {
  ...vpcConfig,
  projectRoot:      repoRoot,
  depsLockFilePath: lockFile,
  logRetention:     isProd ? RetentionDays.TWO_WEEKS : RetentionDays.ONE_WEEK,
};
```

`lambdaBase`를 spread하는 API Lambda 7개 전체에 자동 적용.

### crawler-stack.ts

```typescript
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

const isProd = envName === 'prod';

const crawlerFn = new AppLambda(this, 'CrawlerWorker', {
  ...
  logRetention: isProd ? RetentionDays.TWO_WEEKS : RetentionDays.ONE_WEEK,
  ...
});
```

---

## logRetention 동작 방식

`AppLambda.ts`에서 `logRetention: RetentionDays.ONE_WEEK`을 기본값으로 설정하지만, `...props` 이전에 위치하므로 스택에서 전달한 값이 우선 적용된다.

| 환경 | 보존 기간 | CloudWatch 비용 |
|------|----------|----------------|
| dev | 7일 (ONE_WEEK) | ~$0/월 (5GB 무료) |
| prod | 14일 (TWO_WEEKS) | ~$1/월 |

---

## 검증

- `npx tsc --noEmit` — **오류 0건**

---

## 예상 cdk diff (prod)

```
[~] AWS::Logs::LogGroup  /aws/lambda/GetEventsFunction
    [-] RetentionInDays: 7
    [+] RetentionInDays: 14
[~] AWS::Logs::LogGroup  /aws/lambda/CreateEventFunction    (동일)
[~] AWS::Logs::LogGroup  /aws/lambda/GetEventFunction       (동일)
[~] AWS::Logs::LogGroup  /aws/lambda/DeleteEventFunction    (동일)
[~] AWS::Logs::LogGroup  /aws/lambda/GetIPsFunction         (동일)
[~] AWS::Logs::LogGroup  /aws/lambda/CreateIPFunction       (동일)
[~] AWS::Logs::LogGroup  /aws/lambda/DeleteIPFunction       (동일)
[~] AWS::Logs::LogGroup  /aws/lambda/CrawlerWorker          (동일)
```

---

*Stage 4 진행 대기 — 작업지시자 승인 요청*
