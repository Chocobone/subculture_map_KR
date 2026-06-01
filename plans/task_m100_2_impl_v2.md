# 구현 계획서 v2 — M100 #2: Aurora 스키마 마이그레이션 + Lambda API CRUD

## 변경 이력

| 버전 | 변경 내용 |
|------|-----------|
| v1 | 최초 작성 |
| v2 | events 테이블에 `place_url`, `place_lat`, `place_lng` 추가 + Naver Local Search API 연동 |

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
├── package.json                            ← 신규
├── tsconfig.json                           ← 신규
└── src/
    └── db/
        └── migrations/
            └── 001_initial_schema.sql      ← 신규
```

**`001_initial_schema.sql` 핵심 내용**:

- `ips` 테이블: `id UUID PK, name TEXT, keywords TEXT[], created_at`
- `events` 테이블:

  ```sql
  CREATE TABLE events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_id       UUID NOT NULL REFERENCES ips(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('popup','collab','goods','limited')),
    place       TEXT,
    place_url   TEXT,                        -- 네이버 지도 장소 직접 링크
    place_lat   DOUBLE PRECISION,            -- WGS84 위도
    place_lng   DOUBLE PRECISION,            -- WGS84 경도
    start_date  DATE,
    end_date    DATE,
    source_url  TEXT,
    status      TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','ended')),
    summary     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```

- `users` 테이블: `id UUID PK (Cognito sub), email TEXT, created_at`
- `subscriptions` 테이블: `user_id UUID FK→users, ip_id UUID FK→ips, PRIMARY KEY(user_id, ip_id)`
- 인덱스: `events(ip_id)`, `events(status)`, `events(start_date, end_date)`

**완료 기준**:
- Docker PostgreSQL에 SQL 적용 후 테이블·인덱스 생성 확인
- `\d events`로 `place_url`, `place_lat`, `place_lng` 컬럼 포함 확인

---

### Stage 2 — Lambda API 핸들러 구현 (events, ips) + Naver Local Search API 연동

**목표**: CRUD 핸들러 구현 + `place` 입력 시 Naver Local Search API로 `place_url`·좌표 자동 저장

**생성 파일**:

```
shared/types/
└── index.ts                                ← 신규 (Event, IP, EventFilter, CrawlSource 타입)

backend/api/src/
├── utils/
│   └── response.ts                         ← 신규 (ok / err 헬퍼)
├── middleware/
│   └── errorHandler.ts                     ← 신규
├── db/
│   ├── client.ts                           ← 신규 (Aurora 연결 풀)
│   └── queries/
│       ├── eventQueries.ts                 ← 신규
│       └── ipQueries.ts                    ← 신규
├── services/
│   ├── cacheService.ts                     ← 신규
│   ├── naverMapsService.ts                 ← 신규 ★ Naver Local Search API 호출
│   ├── eventService.ts                     ← 신규 (place 있으면 naverMapsService 호출)
│   └── ipService.ts                        ← 신규
└── handlers/
    ├── events/
    │   ├── getEvents.ts                    ← 신규
    │   ├── getEvent.ts                     ← 신규
    │   ├── createEvent.ts                  ← 신규
    │   └── deleteEvent.ts                  ← 신규
    └── ips/
        ├── getIPs.ts                       ← 신규
        ├── createIP.ts                     ← 신규
        └── deleteIP.ts                     ← 신규
```

**`naverMapsService.ts` 상세**:

Naver Cloud Platform의 Local Search API를 호출하여 장소 URL과 좌표를 반환한다.

```
API: GET https://openapi.naver.com/v1/search/local.json
헤더: X-Naver-Client-Id, X-Naver-Client-Secret
쿼리: query={place}&display=1

응답 예시:
{
  "items": [{
    "title": "홍대입구역",
    "link": "https://map.naver.com/v5/entry/place/11234567",
    "mapx": "126923819",   ← 경도 × 10^7 (WGS84)
    "mapy": "37556527"     ← 위도 × 10^7 (WGS84)
  }]
}
```

좌표 변환:
- `place_lat = Number(mapy) / 1e7`
- `place_lng = Number(mapx) / 1e7`

반환값:
```typescript
interface PlaceInfo {
  placeUrl: string;      // items[0].link
  placeLat: number;      // items[0].mapy / 1e7
  placeLng: number;      // items[0].mapx / 1e7
}
```

장소 미발견 시 `null` 반환 — `place_url`, `place_lat`, `place_lng` 모두 NULL로 저장.

**`eventService.create` 흐름**:

```
POST /events { place: "홍대입구역", ... }
  ↓
place 값 있음?
  Y → naverMapsService.search(place) 호출
      → { placeUrl, placeLat, placeLng } 획득
  N → 세 필드 모두 NULL
  ↓
eventQueries.insertEvent({ ..., placeUrl, placeLat, placeLng })
  ↓
캐시 무효화 (해당 ipId 관련 캐시 키 삭제)
  ↓
생성된 행사 반환
```

Naver API 키는 Secrets Manager에서 로드 (Lambda 시작 시 1회 캐시):
```
SecretId: subculture-tracker/naver-api (dev)
SecretValue: { "clientId": "...", "clientSecret": "..." }
```

**완료 기준**:
- `npm run test` 통과 (naverMapsService mock 포함 단위 테스트)
- TypeScript 타입 오류 0개

---

### Stage 3 — CDK ApiStack에 Lambda 함수 등록

**목표**: DataStack + ApiStack CDK 코드 작성, Naver API 크리덴셜 Secrets Manager 등록

**생성 파일**:

```
infra/
├── package.json                            ← 신규
├── tsconfig.json                           ← 신규
├── cdk.json                                ← 신규
├── bin/app.ts                              ← 신규
└── lib/
    ├── constructs/
    │   ├── VpcNetwork.ts                   ← 신규
    │   └── AppLambda.ts                    ← 신규
    └── stacks/
        ├── data-stack.ts                   ← 신규 (Aurora, DynamoDB, Naver API Secret)
        └── api-stack.ts                    ← 신규 (API GW + Lambda 7개)
```

**`data-stack.ts` 추가 내용 (v2 변경)**:

```typescript
// Naver API 크리덴셜 시크릿 (수동 값 주입 필요 — cdk deploy 후 콘솔에서 입력)
this.naverApiSecret = new Secret(this, 'NaverApiSecret', {
  secretName: `subculture-tracker/naver-api`,
  description: 'Naver Cloud Platform Local Search API credentials',
});
```

**`api-stack.ts` Lambda 환경 변수 추가 (v2 변경)**:

`CreateEvent` Lambda에만 Naver API 시크릿 ARN 주입:
```typescript
environment: {
  DB_HOST:           dataStack.aurora.clusterEndpoint.hostname,
  DB_SECRET_ARN:     dataStack.dbSecret.secretArn,
  REDIS_URL:         `redis://${dataStack.redis.attrRedisEndpointAddress}:6379`,
  NAVER_SECRET_ARN:  dataStack.naverApiSecret.secretArn,  // ← 추가
}
```

**완료 기준**:
- `npx cdk synth --context env=dev` 오류 없음
- `npx cdk diff --context env=dev` 예상 리소스 목록 확인 (작업지시자 확인)

---

### Stage 4 — SAM Local 로컬 테스트

**목표**: SAM CLI로 Naver API 연동 포함 실제 HTTP 요청/응답 검증

**생성 파일**:

```
backend/api/
├── template.yaml                           ← 신규
├── env.json                                ← 신규 (NAVER_SECRET_ARN 포함)
└── events/
    ├── getEvents.json
    ├── createEvent.json                    ← place 필드 포함 버전
    ├── createEventNoPlace.json             ← place 없는 버전 (place_url NULL 검증)
    ├── getIPs.json
    └── createIP.json
```

**로컬 테스트 시 Naver API 처리**:

SAM Local에서는 실제 Naver API를 호출한다. 로컬 `env.json`에 테스트용 크리덴셜을 직접 주입:
```json
{
  "CreateEventFunction": {
    "NAVER_CLIENT_ID": "<개발용 클라이언트 ID>",
    "NAVER_CLIENT_SECRET": "<개발용 시크릿>"
  }
}
```

**테스트 시나리오**:

| 순서 | 요청 | 기댓값 |
|------|------|--------|
| 1 | `POST /ips` `{"name":"원피스","keywords":["원피스","OP"]}` | 201, `id` 반환 |
| 2 | `POST /events` place 있음 `{"place":"홍대입구역",...}` | 201, `place_url`·`place_lat`·`place_lng` 비어있지 않음 |
| 3 | `POST /events` place 없음 | 201, `place_url` null |
| 4 | `GET /events?ipId=…` | 200, 두 행사 모두 포함 |
| 5 | `GET /events/{id}` | 200, `place_url` 필드 포함 |
| 6 | `DELETE /events/{id}` | 204 |

**완료 기준**:
- 6개 시나리오 모두 기댓값 일치
- `place_lat`, `place_lng` 한국 좌표 범위 확인 (위도 33~38, 경도 124~132)

---

### Stage 5 — dev 스택 배포 + 통합 테스트

**목표**: AWS dev 환경 배포 후 Naver API 연동 포함 E2E 검증

**배포 순서**:

```bash
# 1. cdk diff 확인 (작업지시자 승인)
cd infra && npx cdk diff --all --context env=dev

# 2. DataStack 배포
npx cdk deploy SubcultureTracker-Data-dev --context env=dev

# 3. Naver API 크리덴셜 Secrets Manager에 수동 입력
aws secretsmanager put-secret-value \
  --secret-id subculture-tracker/naver-api \
  --secret-string '{"clientId":"...","clientSecret":"..."}'

# 4. Aurora 마이그레이션 적용
# 001_initial_schema.sql → Aurora 실행

# 5. ApiStack 배포
npx cdk deploy SubcultureTracker-Api-dev --context env=dev
```

**통합 테스트 항목**:

| 엔드포인트 | 확인 항목 |
|-----------|-----------|
| `POST /events` (place 있음) | Aurora에 `place_url`, `place_lat`, `place_lng` 저장 확인 |
| `GET /events/{id}` | 응답 JSON에 세 필드 포함 확인 |
| `POST /events` (place 없음) | 세 필드 NULL로 저장, 에러 없음 |
| Naver API 미발견 장소 | 세 필드 NULL, 201 정상 반환 |

**완료 기준**:
- 모든 통합 테스트 통과
- CloudWatch Logs 에러 없음
- `npm run test -ws` 전체 통과

---

## 파일 생성 요약

| Stage | 신규 파일 수 | 변경 내용 요약 |
|-------|------------|--------------|
| 1 | 3 | events 테이블에 `place_url`, `place_lat`, `place_lng` 3개 컬럼 추가 |
| 2 | 15 | `naverMapsService.ts` 추가, `eventService.create`에 API 연동 로직 추가 |
| 3 | 8 | `data-stack.ts`에 Naver API Secret 추가, `api-stack.ts` Lambda 환경 변수 추가 |
| 4 | 6 | SAM 테스트 이벤트에 place 있음/없음 시나리오 분리 |
| 5 | 0 | 배포·테스트만 |
| **합계** | **32** | |

---

## 사전 준비 (작업지시자)

Stage 4 시작 전 아래 항목이 준비되어야 합니다:

- [ ] Naver Cloud Platform 계정에서 **로컬 검색(Local Search) API** 애플리케이션 등록
- [ ] `Client ID`, `Client Secret` 발급
- [ ] SAM Local 테스트용 크리덴셜 공유 (env.json에 입력)

> Naver Cloud Platform 콘솔 → Application → 등록 → 서비스 환경 "WEB 서비스 URL" 입력 → 사용 API에서 "검색" 선택

---

## 작업지시자 승인 요청

위 구현 계획(v2)으로 진행해도 될까요?

Stage 3 완료 후 `cdk diff` 출력을 별도로 확인받겠습니다.
