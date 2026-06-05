# Stage 5 완료 보고서 — Task M100 #8
## Lambda 런타임 SSM 지원 + CloudWatch 로그 보존 7일

> 완료일: 2026-06-05  
> 브랜치: `local/task8`

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `infra/lib/constructs/AppLambda.ts` | `logRetention: RetentionDays.ONE_WEEK` 기본값 추가 |
| `backend/api/src/services/naverMapsService.ts` | SSM `NAVER_PARAM_PATH` / `NCP_PARAM_PATH` 분기 추가 |
| `backend/crawler/src/utils/naverMapsService.ts` | 동일 |
| `backend/api/package.json` | `@aws-sdk/client-ssm` 의존성 추가 (설치 완료) |
| `backend/crawler/package.json` | 동일 |

---

## 상세 변경 내용

### AppLambda.ts — CloudWatch 로그 보존 7일

```typescript
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

super(scope, id, {
  ...
  logRetention: RetentionDays.ONE_WEEK,  // 7일 보존 — 기본값, 개별 Lambda에서 override 가능
  ...props,
  ...
});
```

모든 AppLambda 인스턴스(API 7개 + 크롤러 1개)에 자동 적용.

### naverMapsService.ts (양 패키지 동일) — 자격증명 우선순위

| 순위 | 조건 | 사용처 |
|------|------|--------|
| 1 | `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` 환경변수 | 로컬 개발 |
| 2 | `NAVER_PARAM_PATH` 환경변수 | **AWS dev (SSM — 신규)** |
| 3 | `NAVER_SECRET_ARN` 환경변수 | 하위 호환 |

NCP(`getNcpCreds`)도 동일한 패턴: `NCP_CLIENT_ID/SECRET` → `NCP_PARAM_PATH` → `NCP_SECRET_ARN`.

---

## 검증

- `infra npx tsc --noEmit` — **오류 0건**
- `backend/api npx tsc --noEmit` — **오류 0건**
- `backend/crawler npx tsc --noEmit` — **오류 0건**

---

*전체 5단계 구현 완료 — 최종 결과 보고서 작성 예정*
