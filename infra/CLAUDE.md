# Infra (AWS CDK) — Claude Code Guide

AWS CDK v2 (TypeScript)로 전체 인프라를 코드로 관리합니다.

> **Hyper-Waterfall 적용**: AWS 리소스 추가·변경 전 반드시 수행 계획서를 작성하고 승인을 받아야 합니다.
> 특히 **Aurora, ElastiCache, OpenSearch**는 변경 시 서비스 중단이 발생할 수 있으므로 신중하게 계획합니다.

---

## 디렉토리 구조

```
infra/
├── bin/app.ts                    ← CDK 앱 진입점 (스택 조합)
├── lib/
│   ├── stacks/
│   │   ├── frontend-stack.ts     ← S3 + CloudFront + Cognito + WAF
│   │   ├── api-stack.ts          ← API Gateway + Lambda API + ElastiCache
│   │   ├── crawler-stack.ts      ← EventBridge + SQS + Lambda Crawler + Bedrock
│   │   ├── data-stack.ts         ← Aurora + DynamoDB + OpenSearch + S3(raw)
│   │   └── notifier-stack.ts     ← SNS + SES + Lambda Notifier + API GW WebSocket
│   └── constructs/
│       ├── AppLambda.ts          ← 공통 Lambda 설정 (PowerTools, VPC, ARM64)
│       └── VpcNetwork.ts         ← VPC + 서브넷 + 보안 그룹
├── cdk.json                      ← CDK 설정 + 환경별 Context
└── tsconfig.json
```

---

## 스택 의존 관계

```
DataStack (Aurora, DynamoDB, OpenSearch, ElastiCache)
     ↑              ↑                  ↑
  ApiStack      CrawlerStack      NotifierStack
     ↑
FrontendStack (CloudFront URL을 Cognito CallbackURL에 주입)
```

---

## 핵심 패턴

### CDK 앱 진입점

```typescript
// bin/app.ts
const envName = app.node.tryGetContext('env') ?? 'dev';
// 사용: npx cdk deploy --all --context env=prod

const dataStack     = new DataStack(app, `SubcultureTracker-Data-${envName}`, { env, envName });
const apiStack      = new ApiStack(app, `SubcultureTracker-Api-${envName}`, { env, envName, dataStack });
const crawlerStack  = new CrawlerStack(app, `SubcultureTracker-Crawler-${envName}`, { env, envName, dataStack });
const notifierStack = new NotifierStack(app, `SubcultureTracker-Notifier-${envName}`, { env, envName, dataStack });
const frontendStack = new FrontendStack(app, `SubcultureTracker-Frontend-${envName}`, { env, envName, apiStack });
```

### 공통 Lambda Construct (모든 Lambda에 적용)

```typescript
// lib/constructs/AppLambda.ts
super(scope, id, {
  runtime:      Runtime.NODEJS_20_X,
  architecture: Architecture.ARM_64,   // Graviton2 — 비용 20% 절감
  timeout:      Duration.seconds(30),
  memorySize:   512,
  bundling: {
    minify: true,
    externalModules: ['@aws-sdk/*'],   // Lambda 내장 SDK 사용 (번들 크기 절감)
  },
  environment: {
    POWERTOOLS_SERVICE_NAME: id,
    LOG_LEVEL: 'INFO',
  },
  ...props,
});
```

### 환경별 설정 (cdk.json)

```json
{
  "context": {
    "dev": {
      "auroraMinCapacity": 0.5,
      "auroraMaxCapacity": 2,
      "domainName": "dev.subculture-tracker.com"
    },
    "prod": {
      "auroraMinCapacity": 1,
      "auroraMaxCapacity": 8,
      "domainName": "subculture-tracker.com"
    }
  }
}
```

---

## 배포 명령

```bash
# 최초 1회: CDK 부트스트랩
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-2

# 변경 사항 미리보기 (반드시 배포 전 확인)
npx cdk diff --all --context env=dev

# 개발 전체 배포
npx cdk deploy --all --context env=dev

# 특정 스택만 배포
npx cdk deploy SubcultureTracker-Crawler-dev

# 스택 제거 (개발 환경만)
npx cdk destroy --all --context env=dev
```

---

## AWS 리소스 변경 시 주의사항

| 리소스 | 주의 사항 |
|--------|-----------|
| Aurora | 인스턴스 클래스 변경 시 재시작 발생. 변경 전 작업지시자 승인 필수 |
| ElastiCache | 노드 타입 변경 시 캐시 초기화. API 응답 지연 일시 증가 |
| OpenSearch | 도메인 이름 변경 시 재생성 → 데이터 초기화. 변경 전 스냅샷 필수 |
| S3 버킷 | 이름은 전역 고유값. `${envName}-subculture-tracker-{suffix}` 형식 사용 |
| VPC Lambda | ENI 생성으로 Cold Start가 길어짐. RDS Proxy 연동 권장 |
| Cognito | User Pool 삭제 시 사용자 데이터 전체 손실. 절대 삭제 금지 |

---

## 새 AWS 리소스 추가 시 절차 (Hyper-Waterfall)

1. GitHub Issue 등록 (추가할 리소스, 목적, 예상 비용 명시)
2. `mydocs/plans/task_{m}_{N}.md` 수행 계획서 → 승인
3. `mydocs/plans/task_{m}_{N}_impl.md` 구현 계획서
   - 어느 스택 파일을 수정할지 명시
   - `cdk diff` 예상 출력 포함
4. 단계별 구현 → `cdk diff` 결과 작업지시자 확인 → 승인 → 배포
5. 최종 보고

---

## 예상 월 비용 (소규모 기준)

| 서비스 | 예상 비용 |
|--------|-----------|
| Lambda (크롤러+API+알림) | $2~5 |
| Aurora Serverless v2 | $15~30 |
| ElastiCache (t4g.micro) | $12 |
| S3 + CloudFront | $2~5 |
| SQS + SNS + SES | $1~3 |
| OpenSearch (t3.small) | $25 |
| Bedrock (Claude Haiku) | $1~3 |
| **합계** | **~$58~83/월** |
