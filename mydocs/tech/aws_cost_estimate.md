# AWS 월간 예상 비용 산출서

> 기준: 2026년 6월 / 리전: ap-northeast-2 (서울) / 소규모 초기 운영 가정  
> 실제 CDK 코드(`infra/lib/stacks/`, `infra/lib/constructs/`)에서 확인된 리소스 기준으로 산출

---

## 가정 (소규모 초기 운영)

| 항목 | 값 |
|------|----|
| 월간 API 요청 수 | 50,000 건 |
| 월간 크롤링 실행 | 720 회 (매 1시간, EventBridge) |
| 활성 사용자 | ~100 명 |
| Aurora ACU 평균 사용률 | 0.5 ACU (dev 최솟값, 유휴 시 거의 0) |
| CloudFront 트래픽 | 10 GB/월 |
| S3 저장 용량 | 1 GB 이하 |
| DynamoDB 요청 | 10만 건/월 |
| Bedrock 분류 요청 | 5,000 건/월 |
| SES 발송 | 1,000 건/월 |
| NAT Gateway 처리량 | 5 GB/월 |

---

## 서비스별 비용 상세

### 1. VPC / NAT Gateway
- **구성**: `natGateways: 1` (VpcNetwork.ts:18)
- NAT Gateway 고정: $0.059/시간 × 720시간 = **$42.48**
- 데이터 처리: 5 GB × $0.059/GB = **$0.30**
- **소계: ~$42.78**

> ⚠️ NAT Gateway는 전체 비용 중 가장 큰 고정 지출입니다. Lambda를 VPC 외부로 이동하거나 VPC 엔드포인트로 대체하면 절감 가능합니다.

---

### 2. Aurora PostgreSQL Serverless v2 (Express 모드)
- **구성**: `serverlessV2MinCapacity: 0.5 ACU`, `serverlessV2MaxCapacity: 2 ACU` (data-stack.ts:52~53)
- Express 모드 활성화: `WithExpressConfiguration: true` (data-stack.ts:63)
- 요금: $0.12/ACU-시간 (서울 리전 Express 모드 기준)
- 평균 0.5 ACU × 720시간 = 360 ACU-시간 × $0.12 = **$43.20**
- 스토리지 (10 GB): 10 × $0.10 = **$1.00**
- I/O (Express 포함, 경량): **~$1.00**
- **소계: ~$45.20**

---

### 3. Lambda
- **구성**: ARM64 Graviton2, 512 MB (API), 1024 MB (크롤러) (AppLambda.ts:12~14, crawler-stack.ts:49)

#### API Lambda (7개 함수)
- 요청: 50,000 건 × 7함수 / 7 = 50,000 건
- 실행 시간: 평균 200ms × 50,000 = 10,000,000 ms
- GB-초: 0.5 GB × 10,000초 = 5,000 GB-초
- 비용: 5,000 × $0.0000133 (ARM64) = **$0.067**
- 요청 비용: 50,000 / 1,000,000 × $0.20 = **$0.010**

#### 크롤러 Lambda (1개)
- 실행: 720 회/월, 평균 30초/회
- GB-초: 1 GB × 720 × 30초 = 21,600 GB-초
- 비용: 21,600 × $0.0000133 = **$0.29**

#### Lambda 합계: **~$0.37** (프리 티어 400,000 GB-초 포함 시 거의 무료)

---

### 4. API Gateway (REST)
- **구성**: `RestApi` (api-stack.ts:94)
- 요청: 50,000 건 × $3.50/100만 = **$0.18**
- **소계: ~$0.18**

---

### 5. SQS
- **구성**: `CrawlerQueue` + `CrawlerDLQ` (crawler-stack.ts:25~37)
- 메시지 수: 720 건/월 (EventBridge → SQS) + 중복 처리 ~2,000건
- 프리 티어 1백만 건/월 이하 → **$0.00**
- **소계: $0.00**

---

### 6. EventBridge
- **구성**: `Schedule.rate(Duration.hours(1))` (crawler-stack.ts:88)
- 규칙 트리거: 720 회/월
- 프리 티어(100만 이벤트/월) 이하 → **$0.00**
- **소계: $0.00**

---

### 7. DynamoDB (2개 테이블)
- **구성**: `BillingMode.PAY_PER_REQUEST` (data-stack.ts:75, 83)
  - `ws-connections-{env}`: WebSocket 연결 관리
  - `crawler-raw-items-{env}`: 크롤 원본 중복 감지
- 쓰기 10만 건 × $1.25/100만 = **$0.13**
- 읽기 10만 건 × $0.25/100만 = **$0.03**
- 스토리지 (1 GB): $0.25
- **소계: ~$0.41**

---

### 8. Secrets Manager
- **구성**: `DbSecret`, `NaverApiSecret` (data-stack.ts:36, 66)
- 2개 시크릿 × $0.40/월 = **$0.80**
- API 호출 (Lambda 기동 시): ~10,000 회 × $0.05/10,000 = **$0.05**
- **소계: ~$0.85**

---

### 9. S3 + CloudFront (프론트엔드)
- **구성**: `SiteBucket` + `Distribution` (frontend-stack.ts:32~56)
- S3 저장: 1 GB × $0.025 = **$0.025**
- CloudFront 트래픽 10 GB × $0.114/GB (서울 리전) = **$1.14**
- CloudFront 요청 100,000 건 × $0.0075/10,000 = **$0.08**
- **소계: ~$1.25**

---

### 10. Route53
- **구성**: `ARecord` → CloudFront Alias (frontend-stack.ts:58~62)
- 호스팅 존: $0.50/월
- 쿼리 100만 건 이내: $0.40
- **소계: ~$0.90**

---

### 11. ACM (인증서)
- **구성**: `ICertificate` (frontend-stack.ts 참조)
- ACM 인증서: **무료**

---

### 12. AWS Bedrock (Claude Haiku — AI 분류)
- **구성**: CLAUDE.md 기술 스택 (크롤러 결과 분류)
- 5,000 건 × 평균 500 토큰 입력 + 200 토큰 출력
- 입력: 2,500,000 토큰 × $0.00025/1,000 = **$0.63**
- 출력: 1,000,000 토큰 × $0.00125/1,000 = **$1.25**
- **소계: ~$1.88**

---

### 13. CloudWatch (로그·모니터링)
- Lambda 로그 (PowerTools): 5 GB/월 × $0.76/GB = **$3.80**
- CloudWatch Logs 저장: **$0.03/GB** × 5 GB = **$0.15**
- **소계: ~$3.95**

---

### 14. SNS / SES (알림 — 구현 예정)
- CLAUDE.md 아키텍처에 포함 (notifier-stack 구현 예정)
- SNS: 1,000 알림 × $0.50/100만 = **$0.00**
- SES: 1,000 건 × $0.10/1,000 = **$0.10**
- **소계: ~$0.10**

---

## 월간 비용 합계

| 서비스 | 개발(dev) 환경 | 비고 |
|--------|---------------|------|
| NAT Gateway | **$42.78** | 고정 최대 비용 항목 |
| Aurora Serverless v2 | **$45.20** | Express 모드, 0.5 ACU 평균 |
| CloudWatch Logs | **$3.95** | PowerTools 로깅 포함 |
| AWS Bedrock (Haiku) | **$1.88** | 월 5,000 분류 기준 |
| S3 + CloudFront | **$1.25** | 정적 호스팅 |
| Secrets Manager | **$0.85** | 2개 시크릿 |
| Route53 | **$0.90** | 호스팅 존 + 쿼리 |
| DynamoDB | **$0.41** | PAY_PER_REQUEST |
| Lambda | **$0.37** | ARM64, 초기 트래픽 |
| API Gateway | **$0.18** | REST API |
| SES | **$0.10** | 알림 발송 |
| SQS / EventBridge | **$0.00** | 프리 티어 범위 |
| ACM | **$0.00** | 무료 |
| **총합** | **≈ $97.87/월** | |

---

## 환경별 비교

| 환경 | Aurora ACU 범위 | 예상 월 비용 |
|------|----------------|-------------|
| **dev** | 0.5 ~ 2 ACU | **~$95~110/월** |
| **prod** | 1 ~ 8 ACU (최대 부하) | **~$150~250/월** |

---

## 비용 절감 포인트

| 방법 | 절감액 | 난이도 |
|------|--------|--------|
| NAT Gateway → VPC 엔드포인트(S3, DynamoDB, Secrets Manager) | ~$30/월 | 중 |
| Aurora 미사용 시 자동 정지 (Serverless v2 min 0 ACU) | ~$15/월 | 낮음 |
| CloudWatch 로그 보존 기간 단축 (현재 무제한) | ~$2/월 | 낮음 |
| Lambda 예약 동시 실행 0 설정 (비 운영 시간) | ~$1/월 | 낮음 |
| 개발 환경 야간/주말 Aurora 정지 스케줄 | ~$20/월 | 낮음 |

> NAT Gateway + Aurora 2개 항목이 전체 비용의 **약 90%** 를 차지합니다.  
> 이 두 항목을 최적화하는 것이 가장 효과적입니다.

---

## 주의 사항

1. **NAT Gateway 미구현 서비스**: OpenSearch, ElastiCache, WebSocket API GW는 현재 CDK 코드에 미구현 상태. 추가 시 월 $30~50 증가 예상.
2. **Aurora 실제 사용량**: Express 모드 적용 시 ACU 스케일링이 더 빠르게 반응함. 트래픽 패턴에 따라 실제 비용 편차 큼.
3. **Bedrock 비용**: 크롤링 소스(트위터/루리웹/네이버카페) 및 수집 IP 수에 따라 선형 증가.
4. **데이터 전송 비용**: Lambda VPC → Aurora 간 동일 AZ 통신은 추가 비용 없음.
5. **AWS 프리 티어**: 신규 계정 12개월 이내 Lambda(100만 건), DynamoDB(25GB) 등 일부 서비스 무료.
