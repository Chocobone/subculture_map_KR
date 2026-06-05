# 수행 계획서 — Task M100 #8
## AWS 무료 플랜 호환 인프라 전환

> 작성일: 2026-06-05  
> 이슈: [#8](https://github.com/Chocobone/subculture_map_KR/issues/8)  
> 마일스톤: M100 (v1.0.0)  
> 브랜치: `local/task8`

---

## 1. 목표

현재 월 ~$98의 AWS 비용을 **무료 플랜 범위 이내($5~8/월)**로 낮춘다.  
기능 동작은 그대로 유지하며, 변경은 **dev 환경 전용**으로 적용한다.  
prod 환경은 별도 Context로 분리되어 현행 사양(Aurora Serverless v2, NAT Gateway)을 유지한다.

---

## 2. 현황 진단

| 항목 | 현재 구성 | 월 비용 | 무료 플랜 해당 여부 |
|------|-----------|---------|-------------------|
| NAT Gateway | `natGateways: 1` (VpcNetwork.ts) | ~$43 | ❌ 미해당 |
| Aurora Serverless v2 | 0.5~2 ACU, Express 모드 (data-stack.ts) | ~$45 | ❌ 미해당 |
| Secrets Manager | 2개 시크릿 (data-stack.ts) | ~$0.85 | ❌ 미해당 (30일 평가판 이후) |
| CloudWatch Logs | 보존 기간 무제한 (Lambda 기본값) | ~$4 | ❌ 기준 초과 |
| Lambda | ARM64 512MB / 1024MB | ~$0.37 | ✅ 무료 |
| DynamoDB | PAY_PER_REQUEST | ~$0.41 | ✅ 무료 (25GB 이내) |
| S3 + CloudFront | 정적 호스팅 | ~$1.25 | ✅ 12개월 무료 |
| API Gateway | REST API | ~$0.18 | ✅ 12개월 무료 |
| SQS / EventBridge | PAY_PER_REQUEST | $0.00 | ✅ 무료 |

---

## 3. 변경 방안

### 3-1. NAT Gateway → NAT Instance (EC2 t2.micro)

**근거**  
NAT Gateway는 무료 플랜 미해당이며 $43/월의 고정 비용이 발생한다.  
CDK `NatProvider.instance()`를 이용해 EC2 t2.micro AMI 기반 NAT Instance로 교체한다.  
t2.micro는 12개월 무료 플랜(750시간/월)에 포함된다.

**변경 파일**: `infra/lib/constructs/VpcNetwork.ts`

```typescript
// 변경 전
this.vpc = new Vpc(this, 'Vpc', {
  maxAzs: 2,
  natGateways: 1,
  ...
});

// 변경 후 (dev 환경)
import { NatProvider } from 'aws-cdk-lib/aws-ec2';
this.vpc = new Vpc(this, 'Vpc', {
  maxAzs: 2,
  natGatewayProvider: natProvider,  // NatProvider.instance() 주입
  natGateways: 1,
  ...
});
```

**제약**  
- NAT Instance는 단일 장애점(SPoF)이나 dev 환경에서 허용
- prod 환경은 Context 분기로 NAT Gateway 유지
- 처리량: ~1 Gbps (dev 규모에서 충분)

---

### 3-2. Aurora Serverless v2 → RDS PostgreSQL db.t3.micro

**근거**  
Aurora Serverless v2는 무료 플랜 미해당($45/월).  
RDS PostgreSQL db.t3.micro는 12개월 무료 플랜(750시간/월, 스토리지 20GB) 포함.  
PostgreSQL 엔진이 동일하므로 SQL 코드와 Lambda 드라이버(`pg`) 변경 없이 마이그레이션 가능.

**변경 파일**: `infra/lib/stacks/data-stack.ts`

```typescript
// 변경 전 (Aurora Serverless v2)
import { DatabaseCluster, ClusterInstance } from 'aws-cdk-lib/aws-rds';
this.aurora = new DatabaseCluster(this, 'Aurora', {
  engine: DatabaseClusterEngine.auroraPostgres({ version: '15.4' }),
  writer: ClusterInstance.serverlessV2('writer'),
  ...
});

// 변경 후 (RDS PostgreSQL db.t3.micro)
import { DatabaseInstance, DatabaseInstanceEngine } from 'aws-cdk-lib/aws-rds';
this.db = new DatabaseInstance(this, 'RdsInstance', {
  engine: DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_15_4 }),
  instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
  ...
});
```

**제약**  
- db.t3.micro: 2 vCPU, 1GB RAM — dev 트래픽에 충분
- Multi-AZ 미설정(`multiAz: false`) — dev 단일 AZ
- 기존 Aurora Express 모드(`WithExpressConfiguration`) 제거
- `DatabaseCluster` → `DatabaseInstance`로 타입 변경 → API Stack / Crawler Stack에서 `.clusterEndpoint.hostname` → `.instanceEndpoint.hostname` 업데이트 필요

---

### 3-3. Secrets Manager → SSM Parameter Store SecureString

**근거**  
Secrets Manager는 30일 평가판 이후 시크릿당 $0.40/월.  
SSM Parameter Store SecureString(표준 등급)은 무료(최대 10,000개).

**변경 파일**: `infra/lib/stacks/data-stack.ts`, `api-stack.ts`, `crawler-stack.ts`  
**영향**: Lambda 런타임 코드(`backend/api/src/`, `backend/crawler/src/`)에서 Secrets Manager SDK → SSM SDK 교체

**제약**  
- SSM SecureString은 KMS 암호화 기본 적용(AWS managed key — 무료)
- Lambda 런타임에서 `@aws-sdk/client-ssm` 사용으로 변경
- SSM 파라미터 이름 규칙: `/subculture-tracker/{env}/db-password` 형식

---

### 3-4. CloudWatch Logs 보존 기간 7일 설정

**근거**  
Lambda 기본 로그 보존은 무제한 → 누적 시 CloudWatch 비용 발생.  
dev 환경에서 7일 보존으로 제한.

**변경 파일**: `infra/lib/constructs/AppLambda.ts`

```typescript
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
// logRetention: RetentionDays.ONE_WEEK 추가 (dev 환경)
```

---

## 4. 변경 제외 항목

| 항목 | 사유 |
|------|------|
| Bedrock (Claude Haiku) | 크롤러 분류 핵심 기능; dev에서도 유지 ($1.88/월 허용) |
| Route53 호스팅 존 | $0.50/월이며 도메인 연결 필수; 대안 없음 |
| S3 / CloudFront | 이미 12개월 무료 플랜 범위 |
| prod 환경 | 변경 없음 — Context(`env=prod`) 분기로 Aurora + NAT Gateway 유지 |

---

## 5. 예상 결과

| 항목 | 변경 전 | 변경 후(dev) |
|------|---------|-------------|
| NAT Gateway/Instance | $42.78 | $0.00 (t2.micro 무료) |
| Aurora / RDS | $45.20 | $0.00 (t3.micro 무료) |
| Secrets Manager | $0.85 | $0.00 (SSM 무료) |
| CloudWatch Logs | $3.95 | ~$0.50 (7일 보존) |
| Bedrock | $1.88 | $1.88 |
| 기타 | $4.21 | $4.21 |
| **합계** | **~$98.87** | **~$6.59** |

---

## 6. 구현 계획 단계 (예정)

구현 계획서(`task_m100_8_impl.md`)에서 상세 단계를 정의할 예정이며, 수행 계획서 승인 후 작성한다.

예상 단계 구성 (최소 3단계, 최대 6단계):
1. VpcNetwork — NAT Instance 전환
2. DataStack — RDS db.t3.micro 전환 + SSM Parameter Store 전환
3. ApiStack / CrawlerStack — 엔드포인트·파라미터 ARN 업데이트
4. Lambda 런타임 — SSM 클라이언트 적용
5. CloudWatch 로그 보존 + 전체 `cdk diff` 검증

---

## 7. 위험 및 대응

| 위험 | 가능성 | 대응 |
|------|--------|------|
| NAT Instance 재시작 시 Elastic IP 손실 | 낮음 | EIP 고정 할당 (EIP는 연결 상태에서 무료) |
| RDS db.t3.micro 성능 부족 | 낮음 | dev 규모에서 1GB RAM 충분; 필요 시 db.t3.small로 업사이즈 |
| SSM 파라미터 경로 불일치 | 중간 | CDK Output으로 파라미터 ARN을 Lambda 환경변수에 자동 주입 |
| Aurora 데이터 마이그레이션 | 낮음 | dev DB는 스키마 재생성으로 처리 (데이터 없음) |

---

*작업지시자 승인 요청 — 승인 후 구현 계획서 작성*
