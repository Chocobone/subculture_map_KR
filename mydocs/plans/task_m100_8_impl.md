# 구현 계획서 — Task M100 #8
## AWS 무료 플랜 호환 인프라 전환

> 작성일: 2026-06-05  
> 이슈: [#8](https://github.com/Chocobone/subculture_map_KR/issues/8)  
> 마일스톤: M100 (v1.0.0)  
> 브랜치: `local/task8`  
> 수행 계획서: `mydocs/plans/task_m100_8.md`

---

## 코드 조사 결과

### 변경 파일 목록 (실제 탐색 기반)

| 파일 | 현황 | 변경 내용 |
|------|------|-----------|
| `infra/lib/constructs/VpcNetwork.ts` | `natGateways: 1` (NAT Gateway) | `natGatewayProvider` prop 수신 → dev: NAT Instance, prod: NAT Gateway |
| `infra/lib/stacks/data-stack.ts` | Aurora Serverless v2 + `naverApiSecret: Secret` | dev: RDS db.t3.micro 전환 + Naver → SSM Parameter |
| `infra/lib/stacks/api-stack.ts` | `aurora.clusterEndpoint.hostname`, `NAVER_SECRET_ARN` | `dbEndpointHostname`, `NAVER_PARAM_PATH` 로 교체 |
| `infra/lib/stacks/crawler-stack.ts` | `aurora.clusterEndpoint.hostname`, `NAVER_SECRET_ARN` | 동일 |
| `infra/lib/constructs/AppLambda.ts` | 로그 보존 기간 미설정 (무제한) | `logRetention: RetentionDays.ONE_WEEK` 추가 |
| `backend/api/src/services/naverMapsService.ts` | `NAVER_SECRET_ARN` → Secrets Manager | `NAVER_PARAM_PATH` → SSM GetParameter 지원 추가 |
| `backend/crawler/src/utils/naverMapsService.ts` | 동일 (거의 동일한 코드) | 동일 |

### 핵심 발견 사항

1. **DB 크리덴셜(dbSecret)은 Secrets Manager 유지**: CDK `DatabaseInstance`는 `Credentials.fromSecret()` 기반이며, 별도 Custom Resource 없이 Secrets Manager를 완전 제거하면 비밀번호 관리가 불가. 1개 시크릿($0.40/월)은 허용.
2. **NaverApiSecret만 SSM 전환**: `naverApiSecret`은 초기값이 없는(수동 입력) 시크릿이므로 SSM Parameter Store로 이관 가능.
3. **naverMapsService 이중 구조**: `backend/api`와 `backend/crawler`에 **동일한 파일이 별도 존재** — 두 파일 모두 수정 필요.
4. **NCP_SECRET_ARN 미구성**: CDK 스택에서 `NCP_SECRET_ARN`은 현재 전달되지 않으므로 마이그레이션 범위 외.
5. **DataStack 공개 속성 변경**: `aurora: DatabaseCluster` → `dbEndpointHostname: string`. 소비 스택(api, crawler)은 hostname만 사용하므로 영향 없음.

---

## 구현 단계

### Stage 1 — VpcNetwork: NAT Instance 전환
**파일**: `infra/lib/constructs/VpcNetwork.ts`

#### 변경 내용

`VpcNetworkProps` 인터페이스에 `natGatewayProvider` 옵션을 추가한다.  
DataStack이 환경에 따라 적절한 provider를 생성해 주입한다.

```typescript
// 변경 전
constructor(scope: Construct, id: string) {
  ...
  this.vpc = new Vpc(this, 'Vpc', {
    maxAzs: 2,
    natGateways: 1,
    subnetConfiguration: [...],
  });
}

// 변경 후
interface VpcNetworkProps {
  natGatewayProvider?: NatProvider;  // 미전달 시 기본 NAT Gateway
}

constructor(scope: Construct, id: string, props: VpcNetworkProps = {}) {
  ...
  this.vpc = new Vpc(this, 'Vpc', {
    maxAzs: 2,
    natGateways: 1,
    natGatewayProvider: props.natGatewayProvider,  // undefined이면 CDK 기본값(NAT Gateway)
    subnetConfiguration: [...],
  });
}
```

DataStack에서 환경별 provider 생성:

```typescript
// data-stack.ts 내부
const natProvider = isProd
  ? undefined  // 기본 NAT Gateway
  : NatProvider.instance({
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
    });

this.network = new VpcNetwork(this, 'Network', { natGatewayProvider: natProvider });
```

#### 검증
- `cdk diff` 출력에서 `AWS::EC2::NatGateway` → `AWS::EC2::Instance` (NAT) 변경 확인
- NAT Instance의 보안 그룹: 소스 0.0.0.0/0 → 대상 0.0.0.0/0 (NAT 트래픽 통과 허용) CDK가 자동 설정

---

### Stage 2 — DataStack: Aurora → RDS db.t3.micro (dev)
**파일**: `infra/lib/stacks/data-stack.ts`

#### 변경 내용

`isProd` 분기로 prod는 기존 Aurora Serverless v2, dev는 RDS `DatabaseInstance` (db.t3.micro)를 생성한다.  
공개 속성을 `aurora: DatabaseCluster` 대신 `dbEndpointHostname: string`으로 교체한다.

```typescript
// 변경 전 공개 속성
readonly aurora: DatabaseCluster;

// 변경 후 공개 속성
readonly dbEndpointHostname: string;
// (aurora 속성 제거, 소비 스택은 hostname만 사용하므로 타입 호환 문제 없음)
```

dev 환경 RDS 생성:

```typescript
if (isProd) {
  // 기존 Aurora Serverless v2 코드 (그대로 유지)
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
} else {
  // dev: RDS PostgreSQL db.t3.micro (무료 플랜 12개월)
  const rds = new DatabaseInstance(this, 'RdsInstance', {
    engine:              DatabaseInstanceEngine.postgres({
                           version: PostgresEngineVersion.VER_15_4 }),
    instanceType:        InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
    credentials:         Credentials.fromSecret(this.dbSecret),
    vpc:                 this.network.vpc,
    vpcSubnets:          { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
    securityGroups:      [this.network.dbSg],
    databaseName:        'subculture_tracker',
    removalPolicy:       retain,
    multiAz:             false,            // 단일 AZ — dev 허용
    allocatedStorage:    20,               // 무료 플랜 상한 (GB)
    maxAllocatedStorage: 20,               // 자동 확장 차단
    backupRetention:     Duration.days(1), // 최소 백업
    deleteAutomatedBackups: true,
  });
  this.dbEndpointHostname = rds.instanceEndpoint.hostname;
}
```

#### 검증
- `cdk diff`: `AWS::RDS::DBCluster` 제거, `AWS::RDS::DBInstance` 추가 확인
- `psql -h <endpoint> -U dbadmin -d subculture_tracker` 로 연결 확인

---

### Stage 3 — DataStack: NaverApiSecret → SSM Parameter Store
**파일**: `infra/lib/stacks/data-stack.ts`

#### 변경 내용

`naverApiSecret: Secret` 을 제거하고 `StringParameter` 두 개(Naver, NCP)로 교체한다.

```typescript
// 변경 전
this.naverApiSecret = new Secret(this, 'NaverApiSecret', {
  secretName:  `subculture-tracker/naver-api-${envName}`,
  description: '...',
});

// 변경 후
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

this.naverSsmParam = new StringParameter(this, 'NaverApiParam', {
  parameterName: `/subculture-tracker/${envName}/naver-api`,
  stringValue:   'PLACEHOLDER',  // 배포 후 콘솔/CLI로 JSON {"clientId":"","clientSecret":""} 입력
  description:   'Naver Developers Local Search API 자격증명 (JSON)',
});

this.ncpSsmParam = new StringParameter(this, 'NcpApiParam', {
  parameterName: `/subculture-tracker/${envName}/ncp-api`,
  stringValue:   'PLACEHOLDER',  // 배포 후 콘솔/CLI로 JSON {"clientId":"","clientSecret":""} 입력
  description:   'Naver Cloud Platform Geocoding API 자격증명 (JSON)',
});
```

공개 속성:

```typescript
// 변경 전
readonly naverApiSecret: Secret;

// 변경 후
readonly naverSsmParam: StringParameter;
readonly ncpSsmParam:   StringParameter;
```

#### 배포 후 수동 작업 (기존 Secrets Manager 수동 입력과 동일)
```bash
# Naver Developers 자격증명 입력
aws ssm put-parameter \
  --name "/subculture-tracker/dev/naver-api" \
  --type "SecureString" \
  --value '{"clientId":"YOUR_ID","clientSecret":"YOUR_SECRET"}' \
  --overwrite

# NCP 자격증명 입력  
aws ssm put-parameter \
  --name "/subculture-tracker/dev/ncp-api" \
  --type "SecureString" \
  --value '{"clientId":"YOUR_ID","clientSecret":"YOUR_SECRET"}' \
  --overwrite
```

#### 검증
- `cdk diff`: `AWS::SecretsManager::Secret` (NaverApiSecret) 제거, `AWS::SSM::Parameter` 2개 추가 확인
- `aws ssm get-parameter --name "/subculture-tracker/dev/naver-api"` 응답 확인

---

### Stage 4 — ApiStack + CrawlerStack: 환경변수·권한 업데이트
**파일**: `infra/lib/stacks/api-stack.ts`, `infra/lib/stacks/crawler-stack.ts`

#### api-stack.ts 변경

```typescript
// 변경 전
const { network, aurora, dbSecret, naverApiSecret } = dataStack;
const commonEnv = {
  DB_HOST:       aurora.clusterEndpoint.hostname,
  DB_SECRET_ARN: dbSecret.secretArn,
  ...
};
const createEvent = new AppLambda(this, 'CreateEventFunction', {
  environment: { ...commonEnv, NAVER_SECRET_ARN: naverApiSecret.secretArn },
  ...
});
naverApiSecret.grantRead(createEvent);

// 변경 후
const { network, dbEndpointHostname, dbSecret, naverSsmParam, ncpSsmParam } = dataStack;
const commonEnv = {
  DB_HOST:       dbEndpointHostname,   // aurora.clusterEndpoint.hostname → dbEndpointHostname
  DB_SECRET_ARN: dbSecret.secretArn,
  ...
};
const createEvent = new AppLambda(this, 'CreateEventFunction', {
  environment: {
    ...commonEnv,
    NAVER_PARAM_PATH: naverSsmParam.parameterName,  // NAVER_SECRET_ARN 대체
    NCP_PARAM_PATH:   ncpSsmParam.parameterName,
  },
  ...
});
naverSsmParam.grantRead(createEvent);  // SSM 읽기 권한
ncpSsmParam.grantRead(createEvent);
```

#### crawler-stack.ts 변경

```typescript
// 변경 전
const { network, rawTable, aurora, dbSecret, naverApiSecret } = dataStack;
environment: {
  DB_HOST:          aurora.clusterEndpoint.hostname,
  NAVER_SECRET_ARN: naverApiSecret.secretArn,
  ...
}
naverApiSecret.grantRead(crawlerFn);

// 변경 후
const { network, rawTable, dbEndpointHostname, dbSecret, naverSsmParam, ncpSsmParam } = dataStack;
environment: {
  DB_HOST:          dbEndpointHostname,
  NAVER_PARAM_PATH: naverSsmParam.parameterName,
  NCP_PARAM_PATH:   ncpSsmParam.parameterName,
  ...
}
naverSsmParam.grantRead(crawlerFn);
ncpSsmParam.grantRead(crawlerFn);
```

#### 검증
- `cdk diff`: Lambda 환경변수 `NAVER_SECRET_ARN` 삭제, `NAVER_PARAM_PATH`·`NCP_PARAM_PATH` 추가 확인
- IAM Policy에 `secretsmanager:GetSecretValue` (Naver) 제거, `ssm:GetParameter` 추가 확인

---

### Stage 5 — Lambda 런타임 + AppLambda 로그 보존
**파일**:
- `infra/lib/constructs/AppLambda.ts`
- `backend/api/src/services/naverMapsService.ts`
- `backend/crawler/src/utils/naverMapsService.ts`

#### 5-a. AppLambda.ts — CloudWatch Logs 보존 7일

```typescript
// 변경 전 (없음 — 무제한 보존)
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

// 변경 후
super(scope, id, {
  ...
  logRetention: RetentionDays.ONE_WEEK,  // 7일 보존 추가
  ...
});
```

#### 5-b. naverMapsService.ts (양쪽 패키지 동일하게 적용)

`NAVER_PARAM_PATH` / `NCP_PARAM_PATH` 환경변수가 있으면 SSM에서 자격증명을 가져오는 경로를 추가한다.  
기존 `NAVER_SECRET_ARN` / `NCP_SECRET_ARN` 경로는 하위 호환을 위해 유지한다.  
로컬 개발용 `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` 경로도 그대로 유지한다.

```typescript
// 추가 import
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// getNaverCreds() 내부 — NAVER_PARAM_PATH 분기 추가
async function getNaverCreds() {
  // 1순위: 로컬 개발 환경변수 (기존 유지)
  if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
    return { clientId: process.env.NAVER_CLIENT_ID, clientSecret: process.env.NAVER_CLIENT_SECRET };
  }
  // 2순위: SSM Parameter Store (신규 — AWS 무료 플랜)
  if (process.env.NAVER_PARAM_PATH) {
    if (cachedNaverCreds) return cachedNaverCreds;
    const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    const { Parameter } = await ssm.send(new GetParameterCommand({
      Name:           process.env.NAVER_PARAM_PATH,
      WithDecryption: true,
    }));
    const s = JSON.parse(Parameter!.Value!);
    cachedNaverCreds = { clientId: s.clientId, clientSecret: s.clientSecret };
    return cachedNaverCreds;
  }
  // 3순위: Secrets Manager (기존 유지 — 하위 호환)
  if (process.env.NAVER_SECRET_ARN) { /* 기존 코드 */ }
  return null;
}
```

`getNcpCreds()` 도 동일한 패턴으로 `NCP_PARAM_PATH` 분기 추가.

#### 검증
- 단위 테스트: `backend/api/src/__tests__/naverMapsService.test.ts` 에서 `NAVER_PARAM_PATH` 경로 통과 확인
- CloudWatch Logs 그룹에 `/aws/lambda/...` 로그 보존 기간 `7 days` 설정 확인

---

## 단계별 커밋 계획

| Stage | 커밋 메시지 형식 | 수정 파일 |
|-------|----------------|-----------|
| 1 | `Task #8 Stage1: VpcNetwork NAT Instance 전환 (dev t2.micro)` | VpcNetwork.ts, data-stack.ts (natProvider 부분) |
| 2 | `Task #8 Stage2: DataStack dev Aurora → RDS PostgreSQL db.t3.micro` | data-stack.ts |
| 3 | `Task #8 Stage3: DataStack NaverApiSecret → SSM Parameter Store` | data-stack.ts |
| 4 | `Task #8 Stage4: ApiStack·CrawlerStack 환경변수·권한 SSM 전환` | api-stack.ts, crawler-stack.ts |
| 5 | `Task #8 Stage5: naverMapsService SSM 지원 + Lambda 로그 보존 7일` | AppLambda.ts, naverMapsService.ts ×2 |

---

## 비용 재산출 (Stage 5 완료 기준)

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| NAT Gateway / Instance | $42.78 | $0 (t2.micro 12개월 무료) |
| Aurora / RDS | $45.20 | $0 (t3.micro 12개월 무료) |
| Secrets Manager | $0.85 (2개) | $0.40 (1개: DB 크리덴셜 유지) |
| CloudWatch Logs | $3.95 | ~$0.50 (7일 보존) |
| 기타 | $6.09 | $6.09 |
| **합계** | **~$98.87** | **~$6.99** |

---

*작업지시자 승인 요청 — 승인 후 Stage 1부터 구현 시작*
