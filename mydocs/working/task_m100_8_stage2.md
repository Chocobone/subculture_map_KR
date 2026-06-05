# Stage 2 완료 보고서 — Task M100 #8
## DataStack: Aurora Serverless v2 → RDS PostgreSQL db.t3.micro (dev)

> 완료일: 2026-06-05  
> 브랜치: `local/task8`

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `infra/lib/stacks/data-stack.ts` | Aurora/RDS 분기 로직 추가, `dbEndpointHostname` 속성 교체 |

---

## 상세 변경 내용

### 신규 import

```typescript
import { Duration } from 'aws-cdk-lib';
import {
  DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion,
} from 'aws-cdk-lib/aws-rds';
```

### 클래스 속성 변경

| 변경 전 | 변경 후 |
|---------|---------|
| `readonly aurora: DatabaseCluster` | `readonly dbEndpointHostname: string` |

소비 스택(`api-stack.ts`, `crawler-stack.ts`)은 hostname만 필요로 하므로 인터페이스 노출을 최소화.

### DB 생성 로직 — prod/dev 분기

**prod (`isProd === true`)**
- 기존 `DatabaseCluster` (Aurora Serverless v2) 코드 유지
- ACU 범위: `ctx.auroraMinCapacity ?? 1` ~ `ctx.auroraMaxCapacity ?? 8`
- Express 모드 (`WithExpressConfiguration: true`) 유지
- `this.dbEndpointHostname = aurora.clusterEndpoint.hostname`

**dev (`isProd === false`)**
- `DatabaseInstance` (RDS PostgreSQL db.t3.micro) 신규 생성
- `PostgresEngineVersion.VER_15_4` — Aurora와 동일 버전으로 SQL 호환
- `multiAz: false` — 단일 AZ (dev 허용)
- `allocatedStorage: 20`, `maxAllocatedStorage: 20` — 무료 플랜 상한(20GB) 고정
- `backupRetention: Duration.days(1)` — 최소 백업 (무료 플랜)
- `deleteAutomatedBackups: true`
- `this.dbEndpointHostname = rds.instanceEndpoint.hostname`

---

## 검증

- `npx tsc --noEmit` — `data-stack.ts` 자체 오류 없음
- `api-stack.ts`, `crawler-stack.ts`의 `aurora` 참조 오류 2건 — Stage 4에서 해결 예정 (기대된 오류)

---

## 예상 cdk diff (dev 환경)

```
[-] AWS::RDS::DBCluster         Network/Aurora                  제거
[-] AWS::RDS::DBInstance        Network/Aurora/writer           제거
[-] CfnDBCluster override       WithExpressConfiguration        제거
[+] AWS::RDS::DBInstance        Network/RdsInstance             추가 (db.t3.micro)
[+] AWS::RDS::DBSubnetGroup     Network/RdsInstance/SubnetGroup 추가
```

prod 환경(`--context env=prod`)에서는 변경 없음.

---

*Stage 3 진행 대기 — 작업지시자 승인 요청*
