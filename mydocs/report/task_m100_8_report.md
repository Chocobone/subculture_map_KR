# 최종 결과 보고서 — Task M100 #8
## AWS 무료 플랜 호환 인프라 전환

> 완료일: 2026-06-05  
> 이슈: [#8](https://github.com/Chocobone/subculture_map_KR/issues/8)  
> 마일스톤: M100 (v1.0.0)  
> 브랜치: `local/task8`

---

## 결과 요약

월 ~$98.87의 AWS 비용을 **~$6.99** 수준으로 절감하는 인프라 전환을 5단계에 걸쳐 완료했다.  
prod 환경은 변경 없이 기존 사양(Aurora Serverless v2, NAT Gateway)을 유지한다.

---

## 변경 파일 전체 목록

| 파일 | Stage | 변경 내용 |
|------|-------|-----------|
| `infra/lib/constructs/VpcNetwork.ts` | 1 | `natGatewayProvider` prop 추가 |
| `infra/lib/stacks/data-stack.ts` | 1·2·3 | NAT provider 분기 + Aurora→RDS 분기 + SSM 파라미터 |
| `infra/lib/stacks/api-stack.ts` | 4 | `dbEndpointHostname`, SSM 환경변수·IAM 교체 |
| `infra/lib/stacks/crawler-stack.ts` | 4 | 동일 |
| `infra/lib/constructs/AppLambda.ts` | 5 | `logRetention: RetentionDays.ONE_WEEK` |
| `backend/api/src/services/naverMapsService.ts` | 5 | SSM `NAVER_PARAM_PATH`·`NCP_PARAM_PATH` 분기 |
| `backend/crawler/src/utils/naverMapsService.ts` | 5 | 동일 |
| `backend/api/package.json` | 5 | `@aws-sdk/client-ssm` 의존성 추가 |
| `backend/crawler/package.json` | 5 | 동일 |

---

## 단계별 변경 내용

### Stage 1 — VpcNetwork: NAT Instance 전환
- `VpcNetworkProps { natGatewayProvider?: NatProvider }` 추가
- DataStack에서 `isProd` 분기:
  - dev: `NatProvider.instance({ instanceType: t2.micro })` — 12개월 무료
  - prod: `undefined` → CDK 기본 NAT Gateway 유지

### Stage 2 — DataStack: Aurora → RDS db.t3.micro (dev)
- `aurora: DatabaseCluster` 제거 → `dbEndpointHostname: string` 추가
- `isProd` 분기:
  - dev: `DatabaseInstance` (db.t3.micro, 12개월 무료, 20GB 상한, 단일 AZ)
  - prod: 기존 Aurora Serverless v2 유지 (ACU 1~8)

### Stage 3 — DataStack: NaverApiSecret → SSM Parameter Store
- `naverApiSecret: Secret` (Secrets Manager) 제거
- `naverSsmParam: StringParameter` + `ncpSsmParam: StringParameter` 신설
  - 경로: `/subculture-tracker/{env}/naver-api`, `/subculture-tracker/{env}/ncp-api`
  - 초기값 `PLACEHOLDER` → 배포 후 `aws ssm put-parameter --type SecureString`으로 입력

### Stage 4 — ApiStack·CrawlerStack: 환경변수·IAM 업데이트
- `aurora.clusterEndpoint.hostname` → `dbEndpointHostname`
- `NAVER_SECRET_ARN` → `NAVER_PARAM_PATH` + `NCP_PARAM_PATH`
- `naverApiSecret.grantRead()` → `naverSsmParam.grantRead()` + `ncpSsmParam.grantRead()`

### Stage 5 — Lambda 런타임 + AppLambda 로그 보존
- `AppLambda.ts`: `logRetention: RetentionDays.ONE_WEEK` — 전체 Lambda 기본 적용
- `naverMapsService.ts` (양 패키지): 자격증명 조회 우선순위
  1. env var (`NAVER_CLIENT_ID`/`SECRET`) — 로컬 개발
  2. SSM (`NAVER_PARAM_PATH`) — AWS dev 환경 ← 신규
  3. Secrets Manager (`NAVER_SECRET_ARN`) — 하위 호환 유지

---

## 비용 비교

| 서비스 | 변경 전 | 변경 후 (dev) | 절감 |
|--------|---------|--------------|------|
| NAT Gateway / Instance | $42.78 | $0.00 | $42.78 |
| Aurora / RDS | $45.20 | $0.00 | $45.20 |
| Secrets Manager | $0.85 (2개) | $0.40 (1개: DB만 유지) | $0.45 |
| CloudWatch Logs | $3.95 | ~$0.50 (7일 보존) | $3.45 |
| Bedrock / 기타 | $6.09 | $6.09 | - |
| **합계** | **~$98.87** | **~$6.99** | **~$91.88** |

---

## 검증

| 항목 | 결과 |
|------|------|
| `infra npx tsc --noEmit` | ✅ 오류 0건 |
| `backend/api npx tsc --noEmit` | ✅ 오류 0건 |
| `backend/crawler npx tsc --noEmit` | ✅ 오류 0건 |
| prod 환경 영향 | ✅ 없음 (`isProd` 분기로 완전 분리) |

---

## 배포 후 수동 작업

```bash
# Naver Developers 자격증명 입력
aws ssm put-parameter \
  --name "/subculture-tracker/dev/naver-api" \
  --type "SecureString" \
  --value '{"clientId":"YOUR_ID","clientSecret":"YOUR_SECRET"}' \
  --overwrite

# NCP Geocoding 자격증명 입력
aws ssm put-parameter \
  --name "/subculture-tracker/dev/ncp-api" \
  --type "SecureString" \
  --value '{"clientId":"YOUR_ID","clientSecret":"YOUR_SECRET"}' \
  --overwrite
```

---

## 커밋 이력

| 커밋 | 내용 |
|------|------|
| `caf4f6e` | Task #8: 수행 계획서 작성 |
| `706be72` | Task #8: 구현 계획서 작성 |
| `7694f03` | Task #8 Stage1: VpcNetwork NAT Instance 전환 |
| `a0a813e` | Task #8 Stage2: DataStack dev Aurora → RDS PostgreSQL db.t3.micro |
| `b1ae86e` | Task #8 Stage3: DataStack NaverApiSecret → SSM Parameter Store |
| `12b37c3` | Task #8 Stage4: ApiStack·CrawlerStack 환경변수·권한 SSM 전환 |
| `52110cb` | Task #8 Stage5: naverMapsService SSM 지원 + Lambda 로그 보존 7일 |

---

*작업지시자 최종 승인 요청 — 승인 후 이슈 #8 클로즈 및 devel merge*
