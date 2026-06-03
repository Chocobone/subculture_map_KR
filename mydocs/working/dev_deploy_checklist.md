# dev 스택 배포 체크리스트

> 작업지시자가 AWS 자격증명 환경에서 직접 수행

## 사전 조건

```bash
aws sts get-caller-identity   # IAM 자격증명 확인
node --version                # v18 이상
```

## 1단계 — CDK 부트스트랩 (최초 1회)

```bash
cd infra
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-2
```

## 2단계 — 스택 순서대로 배포

```bash
# DataStack 먼저 (Aurora, DynamoDB, Secrets 생성)
npx cdk deploy SubcultureTracker-Data-dev --context env=dev

# Naver API 시크릿 수동 입력 (DataStack 배포 후)
aws secretsmanager put-secret-value \
  --secret-id subculture-tracker/naver-api-dev \
  --secret-string '{"clientId":"neTZb8ckeWDdbD10RRni","clientSecret":"S1nWIkKj5K"}'

# NCP 시크릿 수동 입력
aws secretsmanager put-secret-value \
  --secret-id subculture-tracker/ncp-api-dev \
  --secret-string '{"clientId":"fx8ym4l8fn","clientSecret":"SYKUL5QY2a2nqsBYnJQjHaEgoBs7c5dE8hvKRoq0"}'

# API, Crawler, Notifier 스택
npx cdk deploy SubcultureTracker-Api-dev --context env=dev
npx cdk deploy SubcultureTracker-Crawler-dev --context env=dev
```

## 3단계 — Aurora 마이그레이션 적용

```bash
# Aurora 클러스터 엔드포인트 확인
aws rds describe-db-clusters \
  --query 'DBClusters[?DBClusterIdentifier==`subculture-tracker-data-dev-aurora`].Endpoint' \
  --output text

# 마이그레이션 실행
psql -h <AURORA_ENDPOINT> -U dbadmin -d subculture_tracker \
  -f backend/api/src/db/migrations/001_initial_schema.sql

psql -h <AURORA_ENDPOINT> -U dbadmin -d subculture_tracker \
  -f backend/api/src/db/migrations/002_add_source_url_unique.sql
```

## 4단계 — 배포 후 확인

```bash
# API Gateway URL 확인
aws cloudformation describe-stacks \
  --stack-name SubcultureTracker-Api-dev \
  --query 'Stacks[0].Outputs'

# frontend .env.local VITE_API_URL 업데이트
# VITE_API_URL=https://<api-id>.execute-api.ap-northeast-2.amazonaws.com/prod
```

## 완료 기준

- [ ] DataStack 배포 완료
- [ ] Secrets Manager 값 입력 완료
- [ ] ApiStack 배포 완료
- [ ] CrawlerStack 배포 완료
- [ ] 001 + 002 마이그레이션 적용 완료
- [ ] `GET /events` API 정상 응답 확인
