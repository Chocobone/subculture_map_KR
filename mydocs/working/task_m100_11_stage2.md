# Stage 2 완료 보고서 — Task M100 #11
## data-stack.ts: prod Aurora Serverless v2 → RDS db.t3.micro

> 완료일: 2026-06-05  
> 브랜치: `local/task11`

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `infra/lib/stacks/data-stack.ts` | Aurora 제거, 단일 RDS 블록으로 통합, 불필요 import·ctx 변수 제거 |

---

## 상세 변경 내용

### import 정리

| 제거 | 유지 |
|------|------|
| `DatabaseCluster` | `DatabaseInstance` |
| `DatabaseClusterEngine` | `DatabaseInstanceEngine` |
| `AuroraPostgresEngineVersion` | `PostgresEngineVersion` |
| `ClusterInstance` | `Credentials` |
| `CfnDBCluster` | |

### DB 생성 로직 통합

`isProd` 분기를 제거하고 파라미터 변수화로 단일 `DatabaseInstance` 블록 사용.

| 파라미터 | dev | prod |
|----------|-----|------|
| `allocatedStorage` | 20 GB | 50 GB |
| `maxAllocatedStorage` | 20 GB | 50 GB |
| `backupRetention` | 1일 | 7일 |
| `deleteAutomatedBackups` | true | false |
| `removalPolicy` | DESTROY | RETAIN |

### 기타 정리

- `ctx` 변수 제거 (Aurora capacity 설정에만 사용되던 변수)
- 불필요 공백 정렬 통일

---

## 검증

- `npx tsc --noEmit` — **오류 0건**

---

## 예상 cdk diff (prod)

```
[-] AWS::RDS::DBCluster         DataStack/Aurora               제거
[-] AWS::RDS::DBInstance        DataStack/Aurora/writer        제거
[-] AWS::RDS::DBSubnetGroup     DataStack/Aurora/...           제거
[+] AWS::RDS::DBInstance        DataStack/RdsInstance          추가 (db.t3.micro, 50GB)
[+] AWS::RDS::DBSubnetGroup     DataStack/RdsInstance/...      추가
```

---

## 비용 영향 (prod)

| 항목 | 변경 전 | 변경 후 | 절감 |
|------|---------|---------|------|
| Aurora Serverless v2 | ~$58/월 | — | |
| RDS db.t3.micro 50GB | — | ~$24.73/월 | |
| **합계** | **~$58/월** | **~$24.73/월** | **-$33.27/월** |

---

*Stage 3 진행 대기 — 작업지시자 승인 요청*
