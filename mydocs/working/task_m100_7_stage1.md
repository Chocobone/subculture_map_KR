# Stage 1 완료 보고서 — M100 #7 인프라 코드 작성

| 항목 | 내용 |
|------|------|
| 단계 | Stage 1 / 6 |
| 완료일 | 2026-06-04 |
| 상태 | 승인 대기 |

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

CDK API 정합성을 설치된 `aws-cdk-lib` d.ts 기준으로 직접 확인:

| 항목 | 결과 |
|------|------|
| `S3BucketOrigin.withOriginAccessControl` | ✅ `s3-bucket-origin.d.ts` 확인 |
| `AllowedMethods`, `CachedMethods` | ✅ `distribution.d.ts` 확인 |
| `CloudFrontTarget` | ✅ `aws-route53-targets` 확인 |
| `crossRegionReferences` in StackProps | ✅ `stack.d.ts` 확인 |
| `CertificateValidation.fromDns` | ✅ `aws-certificatemanager` 확인 |

> `cdk synth` 실행은 Node.js PATH 미설정으로 로컬에서 불가.
> **Stage 2 진입 전** 작업지시자 환경에서 아래 명령으로 검증 요청:
> ```bash
> cd infra && npx cdk synth --all --context env=dev 2>&1 | tail -20
> ```

---

## 다음 단계 (Stage 2)

DataStack 배포 + Secrets Manager 값 입력 (작업지시자 수행)
