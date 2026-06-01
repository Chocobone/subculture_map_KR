# Backend / API — Claude Code Guide

API Gateway + Lambda로 구성된 REST API 및 WebSocket API입니다.

> **Hyper-Waterfall 적용**: 핸들러 추가·수정 전 수행 계획서를 작성하고 승인을 받아야 합니다.
> 작업 절차: 루트 `CLAUDE.md` → `mydocs/manual/onboarding_guide.md` 참조.

---

## 디렉토리 구조

```
backend/api/src/
├── handlers/
│   ├── events/
│   │   ├── getEvents.ts       ← GET /events (목록 조회 + IP 필터)
│   │   ├── getEvent.ts        ← GET /events/{id}
│   │   ├── createEvent.ts     ← POST /events (수동 추가)
│   │   └── deleteEvent.ts     ← DELETE /events/{id}
│   ├── ips/
│   │   ├── getIPs.ts          ← GET /ips
│   │   ├── createIP.ts        ← POST /ips
│   │   └── deleteIP.ts        ← DELETE /ips/{id}
│   ├── crawler/
│   │   ├── triggerCrawl.ts    ← POST /crawl/trigger → EventBridge 발행
│   │   └── getCrawlLogs.ts    ← GET /crawl/logs
│   └── websocket/
│       ├── connect.ts         ← $connect (DynamoDB에 connectionId 저장)
│       ├── disconnect.ts      ← $disconnect (DynamoDB에서 connectionId 삭제)
│       └── push.ts            ← 내부용 — SNS → Lambda → PostToConnection
├── middleware/
│   ├── auth.ts                ← JWT 검증 (Cognito)
│   ├── cache.ts               ← Redis 캐시 래퍼
│   └── errorHandler.ts        ← 공통 에러 응답 포맷
├── services/
│   ├── eventService.ts        ← 행사 비즈니스 로직
│   ├── ipService.ts           ← IP 비즈니스 로직
│   └── cacheService.ts        ← ElastiCache 접근
├── db/
│   ├── client.ts              ← Aurora 연결 풀 (pg + RDS Proxy)
│   └── queries/               ← SQL 쿼리 함수 모음
└── utils/
    └── response.ts            ← API GW 응답 헬퍼 (ok, err)
```

---

## 핵심 패턴

### Lambda 핸들러 구조

모든 핸들러는 동일한 구조를 따릅니다.

```typescript
// handlers/events/getEvents.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { eventService } from '../../services/eventService';
import { cacheService } from '../../services/cacheService';
import { ok, err } from '../../utils/response';
import type { EventFilter } from '../../../../shared/types';

const logger = new Logger({ serviceName: 'api-getEvents' });

export const handler: APIGatewayProxyHandler = async (event) => {
  const filter: EventFilter = {
    ipId:   event.queryStringParameters?.ipId,
    type:   event.queryStringParameters?.type as any,
    status: event.queryStringParameters?.status as any,
    page:   Number(event.queryStringParameters?.page ?? 1),
    limit:  Number(event.queryStringParameters?.limit ?? 20),
  };

  // 1. 캐시 확인
  const cacheKey = `events:${JSON.stringify(filter)}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return ok(cached);

  // 2. DB 조회
  const result = await eventService.list(filter);

  // 3. 캐시 저장 (TTL 5분)
  await cacheService.set(cacheKey, result, 300);
  return ok(result);
};
```

### 응답 헬퍼

```typescript
// utils/response.ts
export const ok = (data: unknown, statusCode = 200) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify({ success: true, data }),
});

export const err = (message: string, statusCode = 500) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify({ success: false, message }),
});
```

### Aurora 연결 (Lambda 컨테이너 재사용)

```typescript
// db/client.ts — 핸들러 외부에서 pool 초기화 (컨테이너 재사용 시 재연결 방지)
import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let pool: Pool;

export async function getPool(): Promise<Pool> {
  if (pool) return pool;
  const sm = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN! })
  );
  const secret = JSON.parse(SecretString!);
  pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: secret.username,
    password: secret.password,
    max: 5,              // RDS Proxy가 뒷단 풀링 담당
    idleTimeoutMillis: 10000,
  });
  return pool;
}
```

### EventBridge 이벤트 발행 (수동 크롤 트리거)

```typescript
// handlers/crawler/triggerCrawl.ts
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const eb = new EventBridgeClient({ region: process.env.AWS_REGION });

export const handler: APIGatewayProxyHandler = async (event) => {
  const { ipIds, sources } = JSON.parse(event.body ?? '{}');
  await eb.send(new PutEventsCommand({
    Entries: [{
      Source:       'subculture-tracker.api',
      DetailType:   'ManualCrawlTriggered',
      Detail:       JSON.stringify({ ipIds, sources }),
      EventBusName: process.env.EVENT_BUS_NAME,
    }],
  }));
  return ok({ message: '크롤링이 시작되었습니다.' }, 202);
};
```

---

## REST API 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/events` | 행사 목록 (ipId, type, status, page 필터) |
| GET | `/events/{id}` | 행사 상세 |
| POST | `/events` | 행사 수동 추가 |
| DELETE | `/events/{id}` | 행사 삭제 |
| GET | `/ips` | 관심 IP 목록 |
| POST | `/ips` | IP 추가 |
| DELETE | `/ips/{id}` | IP 삭제 |
| POST | `/crawl/trigger` | 수동 크롤링 트리거 |
| GET | `/crawl/logs` | 크롤링 이력 조회 |

전체 스펙: `docs/api-spec.md`

---

## 환경 변수

```bash
DB_HOST=cluster.cluster-xxx.ap-northeast-2.rds.amazonaws.com
DB_NAME=subculture_tracker
DB_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-2:...
REDIS_URL=redis://xxx.cache.amazonaws.com:6379
EVENT_BUS_NAME=subculture-tracker-bus
WS_CONNECTION_TABLE=ws-connections
AWS_REGION=ap-northeast-2
```

---

## 로컬 테스트

```bash
# 단위 테스트
npm test

# SAM으로 Lambda 로컬 실행
sam local invoke GetEventsFunction --event events/getEvents.json
sam local start-api --env-vars env.json

# Docker로 Aurora 로컬 대체
docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:15
```

---

## 새 엔드포인트 추가 시 절차 (Hyper-Waterfall)

1. GitHub Issue 등록
2. `mydocs/plans/task_{m}_{N}.md` 작성 (어느 핸들러·서비스를 추가/수정할지 명시) → 승인
3. `mydocs/plans/task_{m}_{N}_impl.md` 구현 계획서 작성 → 승인
4. 단계별 구현 → 보고 → 승인
5. `docs/api-spec.md` 업데이트 (스펙 변경 시 필수)
