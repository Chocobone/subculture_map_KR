# Stage 6 완료 보고서 — M100 #2: 통합 테스트 일괄 진행

## 완료 일시

2026-06-02

## 테스트 환경

| 항목 | 내용 |
|------|------|
| 단위 테스트 | Jest (ts-jest), 로컬 실행 |
| 통합 테스트 | Docker Lambda 직접 실행 (SAM CLI 우회) |
| DB | Docker PostgreSQL 15 (포트 5433) |
| Redis | Docker Redis 7 (포트 6380) |
| Lambda 이미지 | `public.ecr.aws/lambda/nodejs:20-rapid-x86_64` |

## 6-1. 단위 테스트 결과

```
npm test (backend/api)
```

| 테스트 파일 | 케이스 | 결과 |
|-------------|--------|------|
| `eventQueries.test.ts` | listEvents 조건 없음, ipId 필터 WHERE 절, insertEvent NULL, deleteEventById true/false | ✅ 5/5 |
| `naverMapsService.test.ts` | 장소 발견 WGS84 반환, 결과 없음 null, API 실패 null, 크리덴셜 없음 null | ✅ 4/4 |
| **합계** | | ✅ **9/9 통과** |

## 6-2. 통합 테스트 결과 (Docker Lambda 직접 실행)

### 사전 준비

```bash
# PostgreSQL
docker run -d --name pg-dev -e POSTGRES_PASSWORD=password -e POSTGRES_DB=subculture_tracker \
  -p 5433:5432 postgres:15

# Redis
docker run -d --name redis-dev -p 6380:6379 redis:7

# 마이그레이션 적용
docker exec -i pg-dev psql -U postgres -d subculture_tracker \
  < backend/api/src/db/migrations/001_initial_schema.sql
```

### 테스트 시나리오 결과

| # | 요청 | 기댓값 | 실제 응답 | 결과 |
|---|------|--------|-----------|------|
| 1 | `POST /ips` `{"name":"원피스","keywords":["원피스","OP","One Piece"]}` | 201, `id` 반환 | 201, id=`23c79fbb-...` | ✅ |
| 2 | `GET /ips` | 200, items에 원피스 포함 | 200, `['원피스']` | ✅ |
| 3 | `POST /events` (place 있음, Naver 크리덴셜 없음) | 201, `placeUrl` null (graceful) | 201, placeUrl=null | ✅ |
| 4 | `POST /events` (place 없음) | 201, `placeUrl` null | 201, placeUrl=null | ✅ |
| 5 | `GET /events?ipId=…` | 200, 두 행사 포함 | 200, total=2 | ✅ |
| 6 | `GET /events/{id}` | 200, `placeUrl` 필드 포함 | 200, placeUrl 필드 있음 | ✅ |
| 7 | `DELETE /events/{id}` | 204 | 204, 삭제 후 total=1 | ✅ |

**전체 7/7 통과** ✅

### SAM CLI env var 주입 이슈 (트러블슈팅)

SAM CLI 1.161.1의 `--env-vars` 플래그가 Docker API fallback(v1.35→v1.44) 환경에서
Lambda 컨테이너에 환경변수를 주입하지 못하는 버그가 발견됨.

**해결**: `sam local invoke` 대신 Docker Runtime Interface를 직접 사용하여 `-e KEY=VALUE`로 명시 주입.
상세: `troubleshootings/sam_local_env_injection.md`

## 6-3. dev 환경 E2E 테스트

| 항목 | 상태 |
|------|------|
| `cdk deploy` DataStack | ⏳ AWS 자격증명 및 VPC 설정 후 작업지시자 수행 |
| Aurora 마이그레이션 적용 | ⏳ 배포 후 |
| `cdk deploy` ApiStack | ⏳ 배포 후 |
| API Gateway 실제 호출 | ⏳ 배포 후 |

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| `npm run test` 전체 통과 | ✅ 9/9 |
| SAM Local 7개 시나리오 모두 기댓값 일치 | ✅ 7/7 (Docker 직접 실행) |
| `place_lat`, `place_lng` 한국 좌표 범위 확인 | ⏳ Naver 크리덴셜 필요 (작업지시자 제공 후 재검증) |
| CloudWatch Logs 에러 없음 | ⏳ dev 배포 후 확인 |

## 다음 단계

Issue #2 전체 구현 완료 — 최종 결과 보고서 작성 및 승인 후 Issue #3 최종 보고, Issue #4(Bedrock 분류기) 진행.
