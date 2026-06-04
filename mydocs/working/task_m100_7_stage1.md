# Stage 1 완료 보고서 — M100 #7 인프라 코드 작성

| 항목 | 내용 |
|------|------|
| 단계 | Stage 1 / 6 |
| 완료일 | 2026-06-04 |
| 상태 | ✅ 완료 |

---

## 작업 내용

### 신규 파일

| 파일 | 설명 |
|------|------|
| `infra/lib/stacks/cert-stack.ts` | Route53 Hosted Zone + ACM 인증서 (us-east-1) |
| `infra/lib/stacks/frontend-stack.ts` | S3 + CloudFront(OAC) + Route53 A 레코드 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `infra/bin/app.ts` | CertStack·FrontendStack 추가, `ctx.domainName` 조건부 생성 |
| `infra/cdk.json` | dev/prod 컨텍스트에 `"domainName": "subculture.chocobone.dev"` 추가 |

---

## 구현 상세

### cert-stack.ts

- `HostedZone` — `subculture.chocobone.dev` 전용 Hosted Zone 생성
- `Certificate` — DNS 검증 방식 ACM 인증서 (CloudFront 요건으로 us-east-1 배포)
- 스택 리전: **us-east-1** (`env: { region: 'us-east-1' }`)

### frontend-stack.ts

- `Bucket` — 정적 호스팅, `BlockPublicAccess.BLOCK_ALL`, dev는 `autoDeleteObjects: true`
- `Distribution` — `S3BucketOrigin.withOriginAccessControl` (OAC 방식), HTTPS 강제
- `ARecord` — Route53 Alias → CloudFront
- SPA fallback: HTTP 403/404 → `index.html` (React Router 지원)
- `CfnOutput` 4개: BucketName, DistributionId, DistributionUrl, DomainUrl

### app.ts

- `crossRegionReferences: true` — CertStack(us-east-1) → FrontendStack(ap-northeast-2) 크로스 리전 참조
- `ctx.domainName` 유무로 Cert/Frontend 스택 조건부 생성 (도메인 없으면 건너뜀)

---

## 검증

`cdk synth --all --context env=dev` 실행 결과 (Node.js v24.11.0):

```
Successfully synthesized to C:\Users\yooho\VSCODE\sub_culture\infra\cdk.out
Supply a stack id (SubcultureTracker-Data-dev, SubcultureTracker-Api-dev,
SubcultureTracker-Crawler-dev, SubcultureTracker-Cert-dev,
SubcultureTracker-Frontend-dev) to display its template.
```

| 항목 | 결과 |
|------|------|
| `S3BucketOrigin.withOriginAccessControl` | ✅ |
| `AllowedMethods`, `CachedMethods`, `CachePolicy` | ✅ |
| `CloudFrontTarget` (Route53 Alias) | ✅ |
| `crossRegionReferences: true` | ✅ |
| `CertificateValidation.fromDns` | ✅ |
| Lambda 번들링 (Api + Crawler) | ✅ |
| 5개 스택 전체 synth | ✅ |

---

## 다음 단계 (Stage 2)

DataStack 배포 + Secrets Manager 값 입력 (작업지시자 수행)
