# Stage 5 완료 보고서 — M100 #2: dev 스택 배포 준비

## 완료 일시

2026-06-01

## 수행 내용

### 1. CDK synth 검증

```
npx cdk synth --context env=dev
```

결과:
- `SubcultureTracker-Data-dev.template.json` 생성 ✅
- `SubcultureTracker-Api-dev.template.json` 생성 ✅
- Lambda 7개 esbuild 번들 완료 ✅
- 출력 경로: `infra/cdk.out/`

### 2. TypeScript 타입 오류 수정

`backend/api/tsconfig.json`의 `rootDir: "src"` 설정이 `shared/types` 임포트를 차단하던 문제 해결.

**변경 내용**:
- `rootDir` 제거 (esbuild가 실제 번들을 담당하므로 `tsc --noEmit` 타입 검사에만 영향)
- `include`에 `../../shared/**/*` 추가

결과: `npx tsc --noEmit` 오류 0개 ✅

### 3. CloudFormation 리소스 목록 (synth 기준)

#### SubcultureTracker-Data-dev

| 리소스 | 설명 |
|--------|------|
| AWS::RDS::DBCluster | Aurora PostgreSQL Serverless v2 |
| AWS::SecretsManager::Secret (dbSecret) | Aurora 자격증명 |
| AWS::SecretsManager::Secret (NaverApiSecret) | Naver Local Search API 키 |
| AWS::ElastiCache::ReplicationGroup | Redis 7.x |
| AWS::DynamoDB::Table | WebSocket 연결 테이블 |
| AWS::EC2::VPC + Subnets + SecurityGroups | VPC 네트워크 |

#### SubcultureTracker-Api-dev

| 리소스 | 설명 |
|--------|------|
| AWS::ApiGateway::RestApi | REST API |
| AWS::Lambda::Function × 7 | GetEvents, GetEvent, CreateEvent, DeleteEvent, GetIPs, CreateIP, DeleteIP |
| AWS::IAM::Role × 7 | Lambda 실행 역할 |

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| `cdk synth` 오류 없음 | ✅ |
| CloudFormation 템플릿 2개 생성 | ✅ |
| TypeScript 타입 오류 0개 | ✅ |
| `cdk deploy` 완료 | ⏳ AWS 자격증명 설정 후 작업지시자 직접 수행 |
| CloudWatch Logs 오류 없음 | ⏳ 배포 후 확인 |

## 배포 절차 (작업지시자 수행)

```bash
# AWS 자격증명 설정 확인
aws sts get-caller-identity

# CDK 부트스트랩 (최초 1회)
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-2

# diff 확인
cd infra
npx cdk diff SubcultureTracker-Data-dev --context env=dev
npx cdk diff SubcultureTracker-Api-dev --context env=dev

# DataStack 배포
npx cdk deploy SubcultureTracker-Data-dev --context env=dev

# Naver API 크리덴셜 입력 (Naver Cloud Platform에서 발급한 키)
aws secretsmanager put-secret-value \
  --secret-id subculture-tracker/naver-api \
  --secret-string '{"clientId":"YOUR_CLIENT_ID","clientSecret":"YOUR_CLIENT_SECRET"}'

# Aurora 마이그레이션 적용 (Aurora에 접속하여 실행)
# psql -h CLUSTER_ENDPOINT -U postgres -d subculture_tracker \
#   < backend/api/src/db/migrations/001_initial_schema.sql

# ApiStack 배포
npx cdk deploy SubcultureTracker-Api-dev --context env=dev
```

## 다음 단계

Stage 6 — 통합 테스트 일괄 진행 (단위 테스트 + SAM Local + dev E2E)

배포 완료 후 Stage 6으로 진행.
