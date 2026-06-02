# Stage 3 완료 보고서 — M100 #2: CDK DataStack + ApiStack 구현

## 완료 일시

2026-06-01

## 생성 파일 목록 (9개)

| 파일 | 설명 |
|------|------|
| `package.json` (루트) | 모노레포 루트 — esbuild@0.28.0 (CDK NodejsFunction 번들러) |
| `infra/package.json` | CDK 앱 의존성 (aws-cdk-lib@2.257.0, constructs, esbuild, ts-node) |
| `infra/tsconfig.json` | CDK 앱 TypeScript 설정 |
| `infra/cdk.json` | CDK 앱 진입점 + dev/prod context |
| `infra/bin/app.ts` | 스택 조합 진입점 (DataStack → ApiStack) |
| `infra/lib/constructs/VpcNetwork.ts` | VPC + 프라이빗 서브넷 + Lambda/DB 보안 그룹 |
| `infra/lib/constructs/AppLambda.ts` | 공통 Lambda (ARM64, Node.js 20, 30s timeout, 512MB) |
| `infra/lib/stacks/data-stack.ts` | Aurora Serverless v2 + Naver API Secret + DynamoDB |
| `infra/lib/stacks/api-stack.ts` | REST API Gateway + Lambda 7개 + IAM 권한 |

## 트러블슈팅 이력

| 오류 | 원인 | 해결 |
|------|------|------|
| `PathNotUnderRoot` | `NodejsFunction`의 기본 `projectRoot`가 `infra/`인데 핸들러가 `backend/api/` 에 위치 | `api-stack.ts`에서 `projectRoot`를 레포 루트로 지정, `depsLockFilePath` 명시 |
| `npx canceled: esbuild@0.28.0` | CDK 2.257.0이 esbuild 0.28.0 필요하나 루트 `node_modules`에 없음 | 루트 `package.json` 생성 + `esbuild@0.28.0` 설치 |
| `ReservedEnvironmentVariable: AWS_REGION` | Lambda 런타임 예약 환경 변수를 직접 주입하려 함 | `commonEnv`에서 `AWS_REGION` 제거 |

## 스택 구성

### DataStack (`SubcultureTracker-Data-dev`)

| 리소스 | 설정 |
|--------|------|
| Aurora Serverless v2 | PostgreSQL 15.4, 0.5~2 ACU (dev), VPC 프라이빗 서브넷 |
| DB Secret | `subculture-tracker/db-dev` — 자동 생성 크리덴셜 |
| Naver API Secret | `subculture-tracker/naver-api-dev` — 배포 후 수동 입력 |
| DynamoDB | `ws-connections-dev` (WebSocket 연결 관리) |
| VPC | 퍼블릭 + 프라이빗 서브넷 2AZ, NAT Gateway 1개 |

### ApiStack (`SubcultureTracker-Api-dev`)

| Lambda | 엔드포인트 | 비고 |
|--------|-----------|------|
| GetEventsFunction | GET /events | 캐시 → DB 조회 |
| GetEventFunction | GET /events/{id} | |
| CreateEventFunction | POST /events | NAVER_SECRET_ARN 추가 주입 |
| DeleteEventFunction | DELETE /events/{id} | |
| GetIPsFunction | GET /ips | |
| CreateIPFunction | POST /ips | |
| DeleteIPFunction | DELETE /ips/{id} | |

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| `npx cdk synth --context env=dev` 오류 없음 | ✅ |
| Lambda 7개 번들 생성 (esbuild minify) | ✅ `253kb` / `102kb` |
| Aurora Serverless v2 정의 | ✅ |
| Naver API Secret 정의 | ✅ |
| IAM — DB Secret을 모든 Lambda에 `grantRead` | ✅ |
| IAM — Naver Secret을 CreateEvent Lambda에만 `grantRead` | ✅ |
| CORS 설정 | ✅ |

## 참고: REDIS_URL 미설정

현재 `commonEnv.REDIS_URL = ''`로 비어 있습니다. ElastiCache는 이후 스택에서 별도 구성됩니다.
Stage 5 배포 전 ElastiCache URL을 ApiStack에 추가해야 합니다.

## 다음 단계

Stage 4 — SAM Local 테스트 템플릿 및 시나리오 검증

승인 후 진행하겠습니다.
