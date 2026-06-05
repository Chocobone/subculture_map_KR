# Stage 4 완료 보고서 — Task M100 #8
## ApiStack·CrawlerStack 환경변수·IAM 권한 업데이트

> 완료일: 2026-06-05  
> 브랜치: `local/task8`

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `infra/lib/stacks/api-stack.ts` | 구조분해·DB_HOST·createEvent 환경변수·IAM 4곳 수정 |
| `infra/lib/stacks/crawler-stack.ts` | 구조분해·DB_HOST·crawler 환경변수·IAM 4곳 수정 |

---

## 상세 변경 내용

### api-stack.ts

| 위치 | 변경 전 | 변경 후 |
|------|---------|---------|
| 구조분해 | `aurora, naverApiSecret` | `dbEndpointHostname, naverSsmParam, ncpSsmParam` |
| `commonEnv.DB_HOST` | `aurora.clusterEndpoint.hostname` | `dbEndpointHostname` |
| `createEvent` 환경변수 | `NAVER_SECRET_ARN: naverApiSecret.secretArn` | `NAVER_PARAM_PATH`, `NCP_PARAM_PATH` |
| IAM | `naverApiSecret.grantRead(createEvent)` | `naverSsmParam.grantRead(createEvent)` + `ncpSsmParam.grantRead(createEvent)` |

### crawler-stack.ts

| 위치 | 변경 전 | 변경 후 |
|------|---------|---------|
| 구조분해 | `aurora, naverApiSecret` | `dbEndpointHostname, naverSsmParam, ncpSsmParam` |
| `crawlerFn` 환경변수 `DB_HOST` | `aurora.clusterEndpoint.hostname` | `dbEndpointHostname` |
| `crawlerFn` 환경변수 Naver | `NAVER_SECRET_ARN: naverApiSecret.secretArn` | `NAVER_PARAM_PATH`, `NCP_PARAM_PATH` |
| IAM | `naverApiSecret.grantRead(crawlerFn)` | `naverSsmParam.grantRead(crawlerFn)` + `ncpSsmParam.grantRead(crawlerFn)` |

---

## 검증

- `npx tsc --noEmit` — 전체 오류 **0건** (Stage 2·3에서 발생한 소비 스택 오류 모두 해소)

---

## 예상 cdk diff (dev 환경)

```
[~] AWS::Lambda::Function  CreateEventFunction  환경변수 변경
    [-] NAVER_SECRET_ARN: arn:aws:secretsmanager:...
    [+] NAVER_PARAM_PATH: /subculture-tracker/dev/naver-api
    [+] NCP_PARAM_PATH:   /subculture-tracker/dev/ncp-api

[~] AWS::Lambda::Function  CrawlerWorker  환경변수 변경 (동일)

[~] AWS::IAM::Policy  CreateEventFunctionServiceRoleDefaultPolicy
    [-] secretsmanager:GetSecretValue  (NaverApiSecret)
    [+] ssm:GetParameter               (NaverApiParam, NcpApiParam)

[~] AWS::IAM::Policy  CrawlerWorkerServiceRoleDefaultPolicy  (동일)
```

---

*Stage 5 진행 대기 — 작업지시자 승인 요청*
