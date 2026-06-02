# Stage 6 완료 보고서 — M100 #3: SAM 로컬 테스트 준비

## 완료 일시

2026-06-01

## 생성 파일 목록

| 파일 | 설명 |
|------|------|
| `backend/crawler/template.yaml` | SAM 템플릿 — CrawlerWorkerFunction + DynamoDB 로컬 |
| `backend/crawler/events/crawlRuliweb.json` | 원피스 키워드 SQS 이벤트 (ruliweb) |

## SAM 로컬 테스트 절차 (통합 테스트 Phase에서 일괄 진행)

```bash
cd backend/crawler

# 빌드
sam build

# DynamoDB Local 실행 (별도 터미널)
docker run -p 8000:8000 amazon/dynamodb-local

# 테이블 생성
aws dynamodb create-table \
  --table-name crawler-raw-items-dev \
  --attribute-definitions AttributeName=urlHash,AttributeType=S \
  --key-schema AttributeName=urlHash,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000

# 함수 실행
sam local invoke CrawlerWorkerFunction \
  --event events/crawlRuliweb.json \
  --env-vars env.json
```

## 완료 기준 점검

| 기준 | 결과 |
|------|------|
| template.yaml 작성 완료 | ✅ |
| 이벤트 JSON 작성 완료 | ✅ |
| 실제 SAM 실행 | ⏳ 통합 테스트 Phase에서 일괄 진행 |

## 다음 단계

Task #3 전체 구현 완료.
다음 이슈: Issue #4 — Bedrock 분류기 구현
