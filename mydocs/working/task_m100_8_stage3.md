# Stage 3 완료 보고서 — Task M100 #8
## DataStack: NaverApiSecret Secrets Manager → SSM Parameter Store

> 완료일: 2026-06-05  
> 브랜치: `local/task8`

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `infra/lib/stacks/data-stack.ts` | `naverApiSecret` 제거 → SSM `naverSsmParam` + `ncpSsmParam` 신설 |

---

## 상세 변경 내용

### 신규 import

```typescript
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
```

### 클래스 속성 변경

| 변경 전 | 변경 후 |
|---------|---------|
| `readonly naverApiSecret: Secret` | `readonly naverSsmParam: StringParameter` |
| (없음) | `readonly ncpSsmParam: StringParameter` |

### SSM Parameter 생성

```typescript
// /subculture-tracker/{env}/naver-api  — Naver Developers Local Search
this.naverSsmParam = new StringParameter(this, 'NaverApiParam', {
  parameterName: `/subculture-tracker/${envName}/naver-api`,
  stringValue:   'PLACEHOLDER',
  description:   '...',
});

// /subculture-tracker/{env}/ncp-api  — NCP Geocoding
this.ncpSsmParam = new StringParameter(this, 'NcpApiParam', {
  parameterName: `/subculture-tracker/${envName}/ncp-api`,
  stringValue:   'PLACEHOLDER',
  description:   '...',
});
```

### 배포 후 수동 입력 (기존 Secrets Manager 수동 입력과 동일)

```bash
aws ssm put-parameter \
  --name "/subculture-tracker/dev/naver-api" \
  --type "SecureString" \
  --value '{"clientId":"YOUR_ID","clientSecret":"YOUR_SECRET"}' \
  --overwrite

aws ssm put-parameter \
  --name "/subculture-tracker/dev/ncp-api" \
  --type "SecureString" \
  --value '{"clientId":"YOUR_ID","clientSecret":"YOUR_SECRET"}' \
  --overwrite
```

---

## 검증

- `npx tsc --noEmit` — `data-stack.ts` 자체 오류 없음
- `api-stack.ts`, `crawler-stack.ts` 참조 오류 4건 — Stage 4에서 해결 예정 (기대된 오류)

---

## 예상 cdk diff (dev 환경)

```
[-] AWS::SecretsManager::Secret  DataStack/NaverApiSecret     제거
[+] AWS::SSM::Parameter          DataStack/NaverApiParam      추가
[+] AWS::SSM::Parameter          DataStack/NcpApiParam        추가
```

---

*Stage 4 진행 대기 — 작업지시자 승인 요청*
