# Stage 4 완료 보고서 — M100 #2: SAM Local 테스트 준비

## 완료 일시

2026-06-01

## 생성 파일 목록 (8개)

| 파일 | 설명 |
|------|------|
| `backend/api/template.yaml` | SAM 템플릿 — Lambda 7개, esbuild 빌드, API Gateway 라우팅 |
| `backend/api/events/createIP.json` | POST /ips 테스트 이벤트 |
| `backend/api/events/getIPs.json` | GET /ips 테스트 이벤트 |
| `backend/api/events/createEvent.json` | POST /events (place 있음 — Naver API 호출) |
| `backend/api/events/createEventNoPlace.json` | POST /events (place 없음 — null 검증) |
| `backend/api/events/getEvents.json` | GET /events?ipId=... |
| `backend/api/events/getEvent.json` | GET /events/{id} |
| `backend/api/events/deleteEvent.json` | DELETE /events/{id} |

## 현재 상태

SAM CLI 및 Docker가 미설치 상태이므로 실제 실행은 설치 후 진행해야 한다.
파일 및 절차는 모두 준비되었다.

## 테스트 실행 절차

### 사전 준비

```bash
# 1. SAM CLI 설치 (Windows)
winget install Amazon.SAM-CLI

# 2. Docker Desktop 설치 및 실행
#    https://www.docker.com/products/docker-desktop

# 3. Docker로 PostgreSQL 실행
docker run -d --name pg-dev \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=subculture_tracker \
  -p 5432:5432 postgres:15

# 4. 마이그레이션 적용
docker exec -i pg-dev psql -U postgres -d subculture_tracker \
  < backend/api/src/db/migrations/001_initial_schema.sql

# 5. Docker로 Redis 실행
docker run -d --name redis-dev -p 6379:6379 redis:7

# 6. env.json 준비 (Stage 1에서 만든 env.json.example 기반)
#    Naver API 키를 CreateEventFunction 항목에 입력
cp backend/api/env.json.example backend/api/env.json
```

### SAM 빌드 및 실행

```bash
cd backend/api

# esbuild로 번들 (sam build)
sam build

# 로컬 API 서버 시작 (localhost:3000)
sam local start-api --env-vars env.json
```

### 테스트 시나리오 (순서 준수)

```bash
# 시나리오 1: IP 생성
curl -s -X POST http://localhost:3000/ips \
  -H "Content-Type: application/json" \
  -d '{"name":"원피스","keywords":["원피스","OP","One Piece"]}' | jq .
# → 201, data.id 저장 (이후 IP_ID로 사용)

# 시나리오 2: GET /ips
curl -s http://localhost:3000/ips | jq .
# → 200, items에 원피스 포함

# 시나리오 3: 행사 생성 (place 있음 — Naver API 호출)
curl -s -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d "{\"ipId\":\"$IP_ID\",\"title\":\"원피스 팝업스토어\",\"type\":\"popup\",\"place\":\"홍대입구역\",\"startDate\":\"2026-07-01\",\"endDate\":\"2026-07-15\"}" | jq .
# → 201, data.placeUrl / data.placeLat / data.placeLng 비어있지 않음
# → 좌표 범위: placeLat 33~38, placeLng 124~132

# 시나리오 4: 행사 생성 (place 없음)
curl -s -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d "{\"ipId\":\"$IP_ID\",\"title\":\"원피스 굿즈\",\"type\":\"goods\"}" | jq .
# → 201, data.placeUrl null

# 시나리오 5: GET /events?ipId=...
curl -s "http://localhost:3000/events?ipId=$IP_ID" | jq .
# → 200, data.items에 두 행사 모두 포함

# 시나리오 6: GET /events/{id}
curl -s "http://localhost:3000/events/$EVENT_ID" | jq .
# → 200, placeUrl 필드 포함

# 시나리오 7: DELETE /events/{id}
curl -s -X DELETE "http://localhost:3000/events/$EVENT_ID"
# → 204
```

### invoke 방식 (start-api 없이 함수 단독 호출)

```bash
# IP 생성
sam local invoke CreateIPFunction \
  --event events/createIP.json \
  --env-vars env.json

# 행사 생성 (events/createEvent.json의 ipId를 실제 값으로 교체 후)
sam local invoke CreateEventFunction \
  --event events/createEvent.json \
  --env-vars env.json
```

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| template.yaml 작성 (Lambda 7개, esbuild, API 라우팅) | ✅ |
| 테스트 이벤트 JSON 7개 작성 | ✅ |
| place 있는/없는 createEvent 시나리오 분리 | ✅ |
| 실제 SAM Local 실행 및 6개 시나리오 검증 | ⏳ SAM CLI + Docker 설치 후 진행 필요 |

## 다음 단계

Stage 5 — dev 스택 배포 + 통합 테스트

Stage 4 실행은 작업지시자가 SAM CLI + Docker 설치 후 위 절차로 직접 진행.
Stage 5 진행 승인 시 AWS dev 환경 배포를 시작하겠습니다.
