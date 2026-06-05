# 구현 계획서 — Task M100 #11
## 인프라 비용 최적화: dev $30/월 · prod $50/월

> 작성일: 2026-06-05  
> 브랜치: `local/task11`  
> Issue: [#11](https://github.com/Chocobone/subculture_map_KR/issues/11)

---

## 구현 단계 개요

| Stage | 대상 파일 | 핵심 변경 |
|-------|-----------|-----------|
| 1 | `data-stack.ts` | 양 환경 NAT Instance 교체: dev t3.nano / prod t3.micro |
| 2 | `data-stack.ts` | prod DB: Aurora Serverless v2 → RDS db.t3.micro (50GB, 7일 백업) |
| 3 | `api-stack.ts`, `crawler-stack.ts` | logRetention 환경별 분기 (dev ONE_WEEK / prod TWO_WEEKS) |
| 4 | `aws_cost_estimate.md` | 최종 비용 추정 문서 업데이트 |

---

## Stage 1 — data-stack.ts: 양 환경 NAT Instance 교체

### 변경 목표

| 환경 | 변경 전 | 변경 후 |
|------|---------|---------|
| dev | `NatInstanceProviderV2` t3.micro | `NatInstanceProviderV2` t3.nano |
| prod | `undefined` (CDK 기본 NAT Gateway) | `NatInstanceProviderV2` t3.micro |

### 변경 내용

```typescript
// 변경 전
const natGatewayProvider = isProd
  ? undefined
  : new NatInstanceProviderV2({
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
    });

// 변경 후
const natGatewayProvider = new NatInstanceProviderV2({
  instanceType: isProd
    ? InstanceType.of(InstanceClass.T3, InstanceSize.MICRO)   // prod: t3.micro
    : InstanceType.of(InstanceClass.T3, InstanceSize.NANO),   // dev:  t3.nano
});
```

### 예상 cdk diff (dev)

```
[~] AWS::EC2::Instance  Network/Vpc/NatInstance
    [-] InstanceType: t3.micro
    [+] InstanceType: t3.nano
```

### 예상 cdk diff (prod)

```
[-] AWS::EC2::NatGateway  Network/Vpc/PublicSubnet1/NATGateway  제거
[-] AWS::EC2::EIP         (NatGateway용 EIP)                    제거
[+] AWS::EC2::Instance    Network/Vpc/NatInstance               추가 (t3.micro, AL2023)
[+] AWS::EC2::EIP         (NatInstance용 EIP)                   추가
[~] AWS::EC2::Route       PrivateSubnet/DefaultRoute            변경
```

### 검증

- `npx tsc --noEmit` — 오류 0건

---

## Stage 2 — data-stack.ts: prod DB Aurora → RDS 교체

### 변경 목표

prod 환경의 `DatabaseCluster`(Aurora Serverless v2)를 `DatabaseInstance`(RDS PostgreSQL db.t3.micro)로 교체한다.

| 항목 | Aurora Serverless v2 | RDS db.t3.micro |
|------|----------------------|-----------------|
| 인스턴스 비용 | ~$58/월 (1 ACU 기준) | ~$18.98/월 |
| 스토리지 | 자동 | 50GB gp2 ($5.75/월) |
| Multi-AZ | 자동 | false (단일 AZ) |
| 백업 보존 | 1일 (기존 설정) | 7일 |

### 변경 내용

```typescript
// prod 분기 변경 전
if (isProd) {
  const aurora = new DatabaseCluster(this, 'Aurora', {
    engine: DatabaseClusterEngine.auroraPostgres({ version: AuroraPostgresEngineVersion.VER_15_4 }),
    credentials:             Credentials.fromSecret(this.dbSecret),
    writer:                  ClusterInstance.serverlessV2('writer'),
    serverlessV2MinCapacity: ctx.auroraMinCapacity ?? 1,
    serverlessV2MaxCapacity: ctx.auroraMaxCapacity ?? 8,
    vpc:                     this.network.vpc,
    vpcSubnets:              { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
    securityGroups:          [this.network.dbSg],
    defaultDatabaseName:     'subculture_tracker',
    removalPolicy:           retain,
  });
  (aurora.node.defaultChild as CfnDBCluster)
    .addPropertyOverride('WithExpressConfiguration', true);
  this.dbEndpointHostname = aurora.clusterEndpoint.hostname;
} else { ... }

// prod 분기 변경 후 (dev와 동일한 DatabaseInstance 사용, 파라미터만 다름)
const allocatedStorage = isProd ? 50 : 20;
const backupDays       = isProd ? 7  : 1;

const rds = new DatabaseInstance(this, 'RdsInstance', {
  engine:               DatabaseInstanceEngine.postgres({
                          version: PostgresEngineVersion.VER_15_4 }),
  instanceType:         InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
  credentials:          Credentials.fromSecret(this.dbSecret),
  vpc:                  this.network.vpc,
  vpcSubnets:           { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
  securityGroups:       [this.network.dbSg],
  databaseName:         'subculture_tracker',
  removalPolicy:        retain,
  multiAz:              false,
  allocatedStorage,
  maxAllocatedStorage:  allocatedStorage,
  backupRetention:      Duration.days(backupDays),
  deleteAutomatedBackups: !isProd,
});
this.dbEndpointHostname = rds.instanceEndpoint.hostname;
```

불필요해진 Aurora 관련 import 제거:
```typescript
// 제거 대상
DatabaseCluster, DatabaseClusterEngine,
AuroraPostgresEngineVersion, ClusterInstance,
CfnDBCluster,
```

### 예상 cdk diff (prod)

```
[-] AWS::RDS::DBCluster         DataStack/Aurora              제거
[-] AWS::RDS::DBInstance        DataStack/Aurora/writer       제거
[+] AWS::RDS::DBInstance        DataStack/RdsInstance         추가 (db.t3.micro, 50GB)
[+] AWS::RDS::DBSubnetGroup     DataStack/RdsInstance/...     추가
```

### 검증

- `npx tsc --noEmit` — 오류 0건

---

## Stage 3 — api-stack.ts, crawler-stack.ts: logRetention 환경별 분기

### 변경 목표

현재 `AppLambda.ts` 기본값 `RetentionDays.ONE_WEEK`이 모든 환경에 적용됨.  
prod는 `TWO_WEEKS`(14일)로 상향해 운영 로그 보존성을 확보한다.

| 환경 | 보존 기간 |
|------|----------|
| dev | 7일 (ONE_WEEK) — 기존 유지 |
| prod | 14일 (TWO_WEEKS) — 신규 |

### 변경 내용

**api-stack.ts**

```typescript
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

// lambdaBase에 logRetention 추가
const lambdaBase = {
  ...vpcConfig,
  projectRoot:      repoRoot,
  depsLockFilePath: lockFile,
  logRetention: isProd ? RetentionDays.TWO_WEEKS : RetentionDays.ONE_WEEK,
};
```

`isProd` 선언 추가:
```typescript
const isProd = envName === 'prod';
```

**crawler-stack.ts** — 동일한 패턴 적용

### 예상 cdk diff (prod)

```
[~] AWS::Logs::LogGroup  /aws/lambda/GetEventsFunction
    [-] RetentionInDays: 7
    [+] RetentionInDays: 14
(모든 Lambda LogGroup 동일)
```

### 검증

- `npx tsc --noEmit` — 오류 0건

---

## Stage 4 — aws_cost_estimate.md 업데이트

### 변경 목표

`mydocs/tech/aws_cost_estimate.md`를 현재 아키텍처 기준으로 재작성한다.

### 문서 구성

- dev 환경 비용 표 (목표: ~$29/월)
- prod 환경 비용 표 (목표: ~$44/월)
- AWS Pricing Calculator 확인 안내
- 비용 절감 항목 요약

---

## 전체 검증 계획

각 Stage 완료 후:

```bash
# infra 타입 체크
cd infra && npx tsc --noEmit

# (선택) 변경 확인
npx cdk diff --all --context env=dev
npx cdk diff --all --context env=prod
```

---

*승인 요청 — 승인 후 Stage 1 구현 시작*
