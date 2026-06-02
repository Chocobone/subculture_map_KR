# Stage 1 완료 보고서 — M100 #2: Aurora 스키마 마이그레이션

## 완료 일시

2026-06-01

## 완료 내용

Aurora PostgreSQL 초기 스키마 마이그레이션 파일 및 프로젝트 기반 파일을 작성했다.

## 생성 파일 목록

| 파일 | 설명 |
|------|------|
| `backend/api/src/db/migrations/001_initial_schema.sql` | Aurora 초기 DDL (4개 테이블 + 인덱스 + 트리거) |
| `backend/api/package.json` | API Lambda 의존성 정의 |
| `backend/api/tsconfig.json` | TypeScript 컴파일러 설정 |
| `backend/api/.env.example` | 환경 변수 템플릿 (로컬 개발용) |
| `backend/api/env.json.example` | SAM Local 환경 변수 템플릿 (함수별 분리) |
| `.gitignore` | `.env.local`, `env.json`, `dist/` 등 제외 |

## 스키마 상세

### 생성 테이블

| 테이블 | 컬럼 수 | 주요 내용 |
|--------|---------|-----------|
| `ips` | 4 | id, name, keywords(TEXT[]), created_at |
| `events` | 16 | id, ip_id, title, type, place, **place_url**, **place_lat**, **place_lng**, start_date, end_date, source_url, status, summary, created_at, updated_at |
| `users` | 3 | id(Cognito sub), email, created_at |
| `subscriptions` | 3 | user_id FK, ip_id FK, created_at |

### 인덱스

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| `idx_events_ip_id` | `events(ip_id)` | IP별 행사 필터 조회 |
| `idx_events_status` | `events(status)` | 상태별 필터 조회 |
| `idx_events_date_range` | `events(start_date, end_date)` | 날짜 범위 조회 |
| `idx_events_place` | `events(place) WHERE place IS NOT NULL` | place 있는 행사만 부분 인덱스 |

### 트리거

- `events_updated_at`: events 행 UPDATE 시 `updated_at` 자동 갱신

## 환경 변수 파일 안내

작업지시자가 채워야 할 항목:

| 파일 | 채워야 할 키 |
|------|------------|
| `backend/api/.env.example` → `.env.local` | `DB_PASSWORD`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| `backend/api/env.json.example` → `env.json` | `DB_PASSWORD`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |

Naver API 발급 경로: [https://developers.naver.com/apps/#/register](https://developers.naver.com/apps/#/register)  
→ 사용 API: **검색 > 지역**

## 로컬 적용 방법

```bash
# 1. Docker PostgreSQL 실행
docker run -d --name pg-dev \
  -e POSTGRES_PASSWORD=<비밀번호> \
  -e POSTGRES_DB=subculture_tracker \
  -p 5432:5432 postgres:15

# 2. 마이그레이션 적용
psql -h localhost -U postgres -d subculture_tracker \
  -f backend/api/src/db/migrations/001_initial_schema.sql

# 3. 테이블 확인
psql -h localhost -U postgres -d subculture_tracker -c "\dt"
psql -h localhost -U postgres -d subculture_tracker -c "\d events"
```

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| 마이그레이션 SQL 파일 작성 | ✅ |
| events 테이블에 place_url, place_lat, place_lng 포함 | ✅ |
| 인덱스 4개 정의 | ✅ |
| updated_at 트리거 정의 | ✅ |
| .env.example 작성 (NAVER 키 항목 포함) | ✅ |
| env.json.example 작성 (함수별 분리) | ✅ |
| .gitignore에 .env.local, env.json 제외 등록 | ✅ |

## 다음 단계

Stage 2 — Lambda API 핸들러 구현 (events, ips) + Naver Local Search API 연동

승인 후 진행하겠습니다.
