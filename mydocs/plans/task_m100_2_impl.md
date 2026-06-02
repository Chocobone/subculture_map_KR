# 구현 계획서 — M100 #2: Aurora 스키마 마이그레이션 + Lambda API CRUD

## 개요

| 항목 | 내용 |
|------|------|
| 이슈 | #2 |
| 마일스톤 | M100 |
| 수행 계획서 | `plans/task_m100_2.md` |
| 브랜치 | `local/task2` |
| 단계 수 | 5단계 |

---

## 단계별 구현 계획

### Stage 1 — Aurora 스키마 마이그레이션 파일 작성

**목표**: Aurora PostgreSQL에 핵심 테이블 4개(events, ips, users, subscriptions)를 생성하는 마이그레이션 SQL 작성

**생성/수정 파일**:

```
backend/api/
├── package.json                            ← 신규 (pg, aws-lambda-powertools 등 의존성)
├── tsconfig.json                           ← 신규
└── src/
    └── db/
        └── migrations/
            └── 001_initial_schema.sql      ← 신규 (핵심 DDL)
```

**`001_initial_schema.sql` 핵심 내용**:
- `ips` 테이블: `id UUID PK, name TEXT, keywords TEXT[], created_at`
- `events` 테이블: `id UUID PK, ip_id UUID FK→ips, title TEXT, type TEXT, place TEXT, start_date DATE, end_date DATE, source_url TEXT, status TEXT, summary TEXT, created_at, updated_at`
- `users` 테이블: `id UUID PK (Cognito sub), email TEXT, created_at`
- `subscriptions` 테이블: `user_id UUID FK→users, ip_id UUID FK→ips, PRIMARY KEY(user_id, ip_id)`
- 인덱스: `events(ip_id)`, `events(status)`, `events(start_date, end_date)`

**완료 기준**:
- `psql`로 로컬 Docker PostgreSQL에 SQL 적용 후 테이블·인덱스 생성 확인
- `\d events`로 컬럼·제약 정상 출력 확인

---

### Stage 2 — Lambda API 핸들러 구현 (events, ips)

**목표**: GET/POST /events, GET /events/{id}, DELETE /events/{id}, GET/POST/DELETE /ips 핸들러 구현

**생성 파일**:

```
shared/types/
└── index.ts                                ← 신규 (Event, IP, EventFilter, CrawlSource 타입)

backend/api/src/
├── utils/
│   └── response.ts                         ← 신규 (ok / err 헬퍼)
├── middleware/
│   └── errorHandler.ts                     ← 신규 (공통 에러 응답 래퍼)
├── db/
│   ├── client.ts                           ← 신규 (Aurora 연결 풀, Secrets Manager)
│   └── queries/
│       ├── eventQueries.ts                 ← 신규 (listEvents, getEvent, insertEvent, deleteEvent SQL)
│       └── ipQueries.ts                    ← 신규 (listIPs, insertIP, deleteIP SQL)
├── services/
│   ├── cacheService.ts                     ← 신규 (ElastiCache Redis GET/SET/DEL)
│   ├── eventService.ts                     ← 신규 (list, get, create, remove 비즈니스 로직)
│   └── ipService.ts                        ← 신규 (list, create, remove 비즈니스 로직)
└── handlers/
    ├── events/
    │   ├── getEvents.ts                    ← 신규 (캐시 → DB 조회 → 캐시 저장)
    │   ├── getEvent.ts                     ← 신규
    │   ├── createEvent.ts                  ← 신규 (POST body 검증 → INSERT)
    │   └── deleteEvent.ts                  ← 신규
    └── ips/
        ├── getIPs.ts                       ← 신규
        ├── createIP.ts                     ← 신규
        └── deleteIP.ts                     ← 신규
```

**핵심 구현 규칙**:
- 모든 핸들러: `middleware/errorHandler.ts`로 래핑 → 예외 시 일관된 에러 응답
- `cacheService`: ElastiCache 미연결 시 fallback 없이 에러 전파 (캐시는 필수 인프라)
- `eventService.list`: `ipId`, `type`, `status` 필터 + `page`/`limit` 페이지네이션
- POST 핸들러: 필수 필드(`title`, `ipId`, `type`) 누락 시 400 반환

**완료 기준**:
- `npm run test` 통과 (단위 테스트: query 함수 mock, service 로직 검증)
- TypeScript 타입 오류 0개 (`tsc --noEmit`)

---

### Stage 3 — CDK ApiStack에 Lambda 함수 등록

**목표**: `infra/` CDK 코드에 DataStack(Aurora, DynamoDB)과 ApiStack(API Gateway + Lambda) 작성

**생성/수정 파일**:

```
infra/
├── package.json                            ← 신규
├── tsconfig.json                           ← 신규
├── cdk.json                                ← 신규 (dev/prod context)
├── bin/
│   └── app.ts                              ← 신규 (스택 조합 진입점)
└── lib/
    ├── constructs/
    │   ├── VpcNetwork.ts                   ← 신규 (VPC + 프라이빗 서브넷 + SG)
    │   └── AppLambda.ts                    ← 신규 (공통 Lambda: ARM64, PowerTools, 30s timeout)
    └── stacks/
        ├── data-stack.ts                   ← 신규 (Aurora Serverless v2, DynamoDB ws-connections)
        └── api-stack.ts                    ← 신규 (REST API GW + 핸들러 7개 Lambda 등록)
```

**`data-stack.ts` 핵심**:
- `ServerlessCluster` (Aurora PostgreSQL Serverless v2, VPC 프라이빗 서브넷)
- Secrets Manager 시크릿 자동 생성 (DB 자격증명)
- `Table` (DynamoDB `ws-connections`, PAY_PER_REQUEST)

**`api-stack.ts` 핵심**:
- `RestApi` (API Gateway, CORS 설정)
- 핸들러별 `AppLambda` 인스턴스 7개: `GetEvents`, `GetEvent`, `CreateEvent`, `DeleteEvent`, `GetIPs`, `CreateIP`, `DeleteIP`
- 각 Lambda에 `DB_HOST`, `DB_SECRET_ARN`, `REDIS_URL` 환경 변수 주입
- Aurora SG에 Lambda SG의 5432 인바운드 허용

**완료 기준**:
- `npx cdk synth --context env=dev` 오류 없이 CloudFormation 템플릿 생성
- `npx cdk diff --context env=dev` 예상 리소스 목록 확인

---

### Stage 4 — SAM Local 로컬 테스트

**목표**: SAM CLI로 Lambda를 로컬 실행하여 실제 HTTP 요청/응답 검증

**생성 파일**:

```
backend/api/
├── template.yaml                           ← 신규 (SAM 템플릿 — CDK synth 출력 기반 단순화)
├── env.json                                ← 신규 (로컬 환경 변수: Docker PostgreSQL + dummy Redis)
└── events/
    ├── getEvents.json                      ← 신규 (GET /events 테스트 이벤트)
    ├── createEvent.json                    ← 신규 (POST /events 테스트 이벤트)
    ├── getIPs.json                         ← 신규
    └── createIP.json                       ← 신규
```

**테스트 시나리오**:

| 순서 | 요청 | 기댓값 |
|------|------|--------|
| 1 | `POST /ips` `{"name":"원피스","keywords":["원피스","OP"]}` | 201, `id` 반환 |
| 2 | `GET /ips` | 200, 생성된 IP 목록 |
| 3 | `POST /events` `{"ipId":"<위 id>","title":"원피스 팝업","type":"popup","place":"홍대"}` | 201 |
| 4 | `GET /events?ipId=<id>` | 200, 생성된 행사 포함 |
| 5 | `DELETE /events/{id}` | 204 |
| 6 | `GET /events?ipId=<id>` | 200, 삭제된 행사 없음 |

**사전 조건**:
- Docker로 PostgreSQL 15 실행: `docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:15`
- Stage 1 마이그레이션 SQL 적용 후 테스트

**완료 기준**:
- 위 6개 시나리오 모두 기댓값과 일치
- SAM Local 로그에 에러 없음

---

### Stage 5 — dev 스택 배포 + 통합 테스트

**목표**: AWS dev 환경에 실제 배포 후 API Gateway 엔드포인트로 E2E 검증

**실행 순서**:

```bash
# 1. CDK diff로 변경 내용 최종 확인 (작업지시자 확인 필요)
cd infra && npx cdk diff --all --context env=dev

# 2. DataStack 먼저 배포 (Aurora 프로비저닝 ~3분)
npx cdk deploy SubcultureTracker-Data-dev --context env=dev

# 3. Aurora에 마이그레이션 SQL 적용 (Secrets Manager 크리덴셜 사용)
# backend/api/src/db/migrations/001_initial_schema.sql

# 4. ApiStack 배포
npx cdk deploy SubcultureTracker-Api-dev --context env=dev

# 5. API Gateway URL로 통합 테스트
```

**통합 테스트 항목**:

| 엔드포인트 | 확인 항목 |
|-----------|-----------|
| `POST /ips` | Aurora에 행 삽입 확인 |
| `GET /events` | 200 응답 + 페이지네이션 필드 존재 |
| `POST /events` | 201 응답 + CloudWatch 로그 정상 |
| `GET /events?ipId=…` | 필터 동작 확인 |

**완료 기준**:
- 모든 통합 테스트 통과
- CloudWatch Logs에 에러 없음
- `npm run test -ws` 전체 통과

---

## 파일 생성 요약

| Stage | 신규 파일 수 | 수정 파일 수 |
|-------|------------|------------|
| 1 | 3 (`package.json`, `tsconfig.json`, SQL) | 0 |
| 2 | 14 (types, utils, db, services, handlers) | 0 |
| 3 | 8 (CDK infra) | 0 |
| 4 | 6 (SAM template + test events) | 0 |
| 5 | 0 (배포·테스트만) | 0 |
| **합계** | **31** | **0** |

---

## 브랜치 및 커밋 계획

```
local/task2 브랜치에서 단계별 커밋

Stage 1 커밋: "Task #2: Aurora 초기 스키마 마이그레이션 SQL 작성"
Stage 2 커밋: "Task #2: Lambda API 핸들러 및 서비스 레이어 구현"
Stage 3 커밋: "Task #2: CDK DataStack + ApiStack 구현"
Stage 4 커밋: "Task #2: SAM Local 테스트 템플릿 및 이벤트 파일 추가"
Stage 5 커밋: "Task #2: dev 배포 완료 및 통합 테스트 결과 기록"
```

---

## 작업지시자 승인 요청

위 구현 계획으로 진행해도 될까요?

Stage 3 완료 후 `cdk diff` 출력을 별도로 확인받겠습니다.
