# 구현 계획서 — M100 #7 Frontend 배포 스택 + 도메인 연결 + 전체 dev 배포

| 항목 | 내용 |
|------|------|
| 마일스톤 | M100 (v1.0.0) |
| 이슈 | #7 |
| 브랜치 | `local/task7` |
| 작성일 | 2026-06-04 |
| 상태 | 승인 대기 |

---

## 전체 구성도

```
[Route53 HZ: subculture.chocobone.dev]
        ↓ A(Alias)
[CloudFront] ← OAC ← [S3: frontend 정적 빌드]
     ↑ HTTPS
[ACM 인증서: subculture.chocobone.dev @ us-east-1]

[API Gateway] ← Lambda ← [Aurora + DynamoDB]
```

---

## 스택 구성

| 스택 | 리전 | 역할 |
|------|------|------|
| `SubcultureTracker-Data-dev` | ap-northeast-2 | Aurora·DynamoDB·Secrets |
| `SubcultureTracker-Api-dev` | ap-northeast-2 | API Gateway·Lambda |
| `SubcultureTracker-Crawler-dev` | ap-northeast-2 | SQS·EventBridge·Lambda |
| `SubcultureTracker-Cert-dev` | **us-east-1** | ACM 인증서 (CloudFront 필수) |
| `SubcultureTracker-Frontend-dev` | ap-northeast-2 | S3·CloudFront·Route53 |

CertStack과 FrontendStack은 `crossRegionReferences: true`로 연결한다.

---

## 단계별 구현

### Stage 1 — 인프라 코드 작성 + cdk synth 검증

**수정 파일**

| 파일 | 작업 |
|------|------|
| `infra/lib/stacks/cert-stack.ts` | 신규 생성 |
| `infra/lib/stacks/frontend-stack.ts` | 신규 생성 |
| `infra/bin/app.ts` | CertStack·FrontendStack 추가 |
| `infra/cdk.json` | dev/prod domainName·hostedZoneName 추가 |

**cert-stack.ts 핵심 구조**

```typescript
// env: { region: 'us-east-1' }, crossRegionReferences: true
export class CertStack extends Stack {
  readonly certificate: Certificate;
  readonly hostedZone:  HostedZone;

  constructor(scope, id, props) {
    // Route53 Hosted Zone (subculture.chocobone.dev 전용)
    this.hostedZone = new HostedZone(this, 'HZ', {
      zoneName: props.domainName,  // 'subculture.chocobone.dev'
    });

    // ACM 인증서 — DNS 검증
    this.certificate = new Certificate(this, 'Cert', {
      domainName: props.domainName,
      validation: CertificateValidation.fromDns(this.hostedZone),
    });
  }
}
```

**frontend-stack.ts 핵심 구조**

```typescript
// env: { region: 'ap-northeast-2' }, crossRegionReferences: true
export class FrontendStack extends Stack {
  readonly bucketName:       string;
  readonly distributionId:   string;
  readonly distributionUrl:  string;

  constructor(scope, id, props) {
    // S3 정적 버킷 (퍼블릭 차단, OAC 전용)
    const siteBucket = new Bucket(this, 'SiteBucket', {
      bucketName:         `subculture-tracker-frontend-${envName}`,
      blockPublicAccess:  BlockPublicAccess.BLOCK_ALL,
      removalPolicy:      isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects:  !isProd,
    });

    // CloudFront 배포
    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin:                S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy:  ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:           CachePolicy.CACHING_OPTIMIZED,
      },
      domainNames:       [props.domainName],
      certificate:       props.certificate,           // CertStack에서 전달 (cross-region)
      defaultRootObject: 'index.html',
      errorResponses: [
        // SPA fallback: 404 → index.html (React Router 지원)
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // Route53 A 레코드 (Alias → CloudFront)
    new ARecord(this, 'AliasRecord', {
      zone:   props.hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    // 배포 후 확인용 Output
    new CfnOutput(this, 'BucketName',      { value: siteBucket.bucketName });
    new CfnOutput(this, 'DistributionId',  { value: distribution.distributionId });
    new CfnOutput(this, 'DistributionUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'DomainUrl',       { value: `https://${props.domainName}` });
  }
}
```

**cdk.json 추가 컨텍스트**

```json
"dev": {
  "auroraMinCapacity": 0.5,
  "auroraMaxCapacity": 2,
  "domainName": "subculture.chocobone.dev"
},
"prod": {
  "auroraMinCapacity": 1,
  "auroraMaxCapacity": 8,
  "domainName": "subculture.chocobone.dev"
}
```

**검증**: `npx cdk synth --all --context env=dev` 에러 없이 통과

---

### Stage 2 — dev DataStack 배포 + Secrets 수동 입력

> **작업지시자 수행** — AWS 자격증명 필요

```bash
cd infra

# CDK bootstrap (최초 1회 — ap-northeast-2)
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-2

# CDK bootstrap (us-east-1 — CertStack용)
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1

# DataStack 배포
npx cdk deploy SubcultureTracker-Data-dev --context env=dev

# Secrets Manager — Naver API 값 입력
aws secretsmanager put-secret-value \
  --secret-id subculture-tracker/naver-api-dev \
  --secret-string '{"clientId":"neTZb8ckeWDdbD10RRni","clientSecret":"S1nWIkKj5K"}'

# Secrets Manager — NCP API 값 입력
aws secretsmanager put-secret-value \
  --secret-id subculture-tracker/ncp-api-dev \
  --secret-string '{"clientId":"fx8ym4l8fn","clientSecret":"SYKUL5QY2a2nqsBYnJQjHaEgoBs7c5dE8hvKRoq0"}'
```

**완료 기준**: DataStack CloudFormation 상태 `CREATE_COMPLETE`

---

### Stage 3 — dev ApiStack + CrawlerStack 배포 + Aurora 마이그레이션

> **작업지시자 수행** — AWS 자격증명 필요

```bash
# ApiStack 배포
npx cdk deploy SubcultureTracker-Api-dev --context env=dev

# CrawlerStack 배포
npx cdk deploy SubcultureTracker-Crawler-dev --context env=dev

# Aurora 엔드포인트 확인
aws cloudformation describe-stacks \
  --stack-name SubcultureTracker-Data-dev \
  --query 'Stacks[0].Outputs'

# Aurora 마이그레이션 (VPN 또는 Bastion 경유)
AURORA_HOST=<위에서 확인한 Endpoint>

psql -h $AURORA_HOST -U dbadmin -d subculture_tracker \
  -f backend/api/src/db/migrations/001_initial_schema.sql

psql -h $AURORA_HOST -U dbadmin -d subculture_tracker \
  -f backend/api/src/db/migrations/002_add_source_url_unique.sql
```

**완료 기준**: `GET /events` 200 응답 확인

---

### Stage 4 — CertStack + FrontendStack 배포 + 프론트엔드 S3 업로드

> **작업지시자 수행** — AWS 자격증명 필요

```bash
# CertStack 배포 (us-east-1)
npx cdk deploy SubcultureTracker-Cert-dev --context env=dev

# FrontendStack 배포 (ap-northeast-2)
npx cdk deploy SubcultureTracker-Frontend-dev --context env=dev

# Output에서 버킷명·배포 ID·CloudFront URL 확인
aws cloudformation describe-stacks \
  --stack-name SubcultureTracker-Frontend-dev \
  --query 'Stacks[0].Outputs'

# API Gateway URL 확인
aws cloudformation describe-stacks \
  --stack-name SubcultureTracker-Api-dev \
  --query 'Stacks[0].Outputs'

# frontend .env.local 업데이트
# VITE_API_URL=https://<api-id>.execute-api.ap-northeast-2.amazonaws.com/prod

# React 빌드
cd frontend && npm run build

# S3 업로드
aws s3 sync dist/ s3://<BUCKET_NAME>/ --delete

# CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

**완료 기준**: `https://<CloudFront URL>` 에서 프론트엔드 정상 로드 (도메인 전파 전 CloudFront URL로 확인)

---

### Stage 5 — Route53 NS 위임 설정 + DNS 전파 확인

CertStack 배포 후 Route53 Hosted Zone이 생성된다. 4개의 NS 레코드를 `chocobone.dev` 관리처에 등록한다.

```bash
# Route53 Hosted Zone NS 레코드 확인
aws route53 list-hosted-zones-by-name \
  --dns-name subculture.chocobone.dev \
  --query 'HostedZones[0].Id' --output text \
  | xargs -I{} aws route53 get-hosted-zone --id {} \
  --query 'DelegationSet.NameServers'
```

출력 예시:
```
["ns-123.awsdns-12.com", "ns-456.awsdns-34.net", "ns-789.awsdns-56.co.uk", "ns-012.awsdns-78.org"]
```

> **작업지시자 조치**: `chocobone.dev` 등록기관(Google Domains·Cloudflare 등) 콘솔에서
> `subculture` 서브도메인에 위 NS 레코드 4개를 등록한다.

```bash
# DNS 전파 확인 (최대 48h, 보통 1~2h)
nslookup subculture.chocobone.dev 8.8.8.8
# 또는
dig subculture.chocobone.dev NS
```

**완료 기준**: `nslookup` 결과에서 CloudFront IP 반환

---

### Stage 6 — 최종 검증 + 완료 보고서

```bash
# 1. 도메인 HTTPS 접속
curl -I https://subculture.chocobone.dev
# → HTTP/2 200, server: CloudFront

# 2. API 동작 확인
curl https://<API_GATEWAY_URL>/prod/events
# → {"events":[], ...} 200

# 3. 브라우저 직접 접속
# https://subculture.chocobone.dev — 자물쇠 표시, 지도 화면 정상 로드

# 4. SPA 라우팅 확인 (새로고침 시 index.html fallback)
# https://subculture.chocobone.dev/events — 직접 접속 정상
```

완료 기준 체크리스트:
- [ ] `https://subculture.chocobone.dev` 200 + 자물쇠
- [ ] 지도 화면 + 목록 화면 정상 렌더링
- [ ] `GET /events` API 실제 Aurora 데이터 반환
- [ ] 페이지 새로고침 후 SPA 라우팅 유지
- [ ] S3 직접 URL 접근 차단 (403) 확인

---

## 브랜치 전략

```bash
git checkout -b local/task7 main
# Stage 1 구현 후 커밋: "Task #7: Stage 1 — FrontendStack + CertStack 코드 구현"
# Stage 2~5는 인프라 배포 단계 (코드 변경 없음, 완료 보고서만 커밋)
# Stage 6 완료 후: 최종 보고서 커밋 → local/devel → devel push
```

---

## 단계별 소요 시간 예상

| 단계 | 소요 시간 | 비고 |
|------|-----------|------|
| Stage 1 | 30~60분 | 코드 작성 + synth 검증 |
| Stage 2 | 20~30분 | DataStack 배포 (Aurora 생성 10~15분) |
| Stage 3 | 15~20분 | ApiStack + CrawlerStack 배포 |
| Stage 4 | 15~20분 | CertStack + FrontendStack + S3 업로드 |
| Stage 5 | 1~48시간 | DNS 전파 대기 (등록기관 처리 속도 의존) |
| Stage 6 | 10~15분 | 검증 |
