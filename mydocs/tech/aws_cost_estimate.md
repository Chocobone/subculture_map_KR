# AWS 월간 예상 비용 산출서

> 기준: 2026년 6월 / 리전: ap-northeast-2 (서울)  
> 비용 목표: **dev $30 이하 / prod $50 이하**  
> Task #11 인프라 기준 (NAT Instance + RDS PostgreSQL db.t3.micro)

---

## 아키텍처 요약

| 항목 | dev | prod |
|------|-----|------|
| NAT | NatInstanceProviderV2 **t3.nano** | NatInstanceProviderV2 **t3.micro** |
| DB | RDS PostgreSQL **db.t3.micro**, 20GB, 1일 백업 | RDS PostgreSQL **db.t3.micro**, 50GB, 7일 백업 |
| CloudWatch 로그 보존 | 7일 | 14일 |
| Lambda | ARM64 Graviton2, 512MB (API) / 1024MB (Crawler) | 동일 |
| 기타 | SSM Parameter Store (자격증명), Secrets Manager (DB) | 동일 |

---

## 트래픽 가정

| 항목 | dev | prod |
|------|-----|------|
| 월간 API 요청 | ~200,000 건 | ~500,000 건 |
| 크롤링 실행 | 720 회/월 (매 1시간) | 720 회/월 |
| CloudFront 트래픽 | 10 GB/월 | 20 GB/월 |
| DynamoDB 요청 | ~1M 건/월 | ~2M 건/월 |
| SES 발송 | — | ~1,000 건/월 |

---

## dev 환경 비용 상세 (~$29/월)

### 1. NAT Instance (EC2 t3.nano)
- t3.nano: $0.0059/시간 × 730시간 = **$4.31**
- EIP (실행 중 인스턴스에 연결 시 무료): **$0.00**
- **소계: ~$4.31**

### 2. RDS PostgreSQL db.t3.micro
- 인스턴스: $0.026/시간 × 730시간 = **$18.98**
- 스토리지 20GB gp2: 20GB × $0.115/GB = **$2.30**
- 백업 (1일, 할당 스토리지 이내): **$0.00**
- **소계: ~$21.28**

### 3. Lambda × 8 (ARM64)
- API Lambda 7개: ~200,000 건, 평균 200ms, 512MB
  - GB-초: 0.5 × 200,000 × 0.2 = 20,000 → **$0.27**
  - 요청: 200,000 × $0.20/100만 = **$0.04**
- 크롤러 Lambda 1개: 720 회 × 30초, 1024MB
  - GB-초: 1.0 × 720 × 30 = 21,600 → **$0.29**
- **소계: ~$0.60**

### 4. API Gateway REST
- 200,000 건 × $3.50/100만 = **$0.70**
- **소계: ~$0.70**

### 5. CloudFront + S3
- CloudFront 10GB × $0.114/GB = **$1.14**
- S3 저장 1GB × $0.025 = **$0.03**
- **소계: ~$1.17**

### 6. DynamoDB (2개 테이블, PAY_PER_REQUEST)
- 쓰기 500K × $1.25/100만 = **$0.63** → 읽기 500K × $0.25/100만 = **$0.13**
- **소계: ~$0.76**

### 7. SQS + EventBridge
- 프리 티어 범위 (각 100만 건/월 이하): **$0.00**

### 8. Secrets Manager (DB 1건)
- 1 × $0.40 = **$0.40** + API 호출 ~$0.05 = **$0.45**

### 9. SSM Parameter Store (Naver/NCP 2건)
- Standard 파라미터: **$0.00** (무료)

### 10. CloudWatch Logs (7일 보존)
- 수집 ~2GB: 처음 5GB/월 무료 → **$0.00**

### 11. Route53
- Hosted Zone: **$0.50**

| 항목 | 비용 |
|------|------|
| NAT Instance t3.nano | $4.31 |
| RDS db.t3.micro 20GB | $21.28 |
| Lambda × 8 | $0.60 |
| API Gateway | $0.70 |
| CloudFront + S3 | $1.17 |
| DynamoDB | $0.76 |
| Secrets Manager | $0.45 |
| Route53 | $0.50 |
| SQS / EventBridge / SSM / CloudWatch | $0.00 |
| **합계** | **≈ $29.77/월 ✅** |

---

## prod 환경 비용 상세 (~$44/월)

### 1. NAT Instance (EC2 t3.micro)
- t3.micro: $0.0136/시간 × 730시간 = **$9.93**
- **소계: ~$9.93**

### 2. RDS PostgreSQL db.t3.micro
- 인스턴스: $0.026/시간 × 730시간 = **$18.98**
- 스토리지 50GB gp2: 50GB × $0.115/GB = **$5.75**
- 백업 스토리지 (7일, 할당 범위 초과분): **~$1.00**
- **소계: ~$25.73**

### 3. Lambda × 8 (ARM64)
- API Lambda 7개: ~500,000 건, 평균 300ms, 512MB → **$0.78**
- 크롤러 Lambda 1개: 720 회 × 30초, 1024MB → **$0.29**
- **소계: ~$1.07**

### 4. API Gateway REST
- 500,000 건 × $3.50/100만 = **$1.75**

### 5. CloudFront + S3
- CloudFront 20GB × $0.114/GB = **$2.28**
- S3 저장 2GB × $0.025 = **$0.05**
- **소계: ~$2.33**

### 6. DynamoDB (2개 테이블)
- 쓰기 1M × $1.25/100만 + 읽기 1M × $0.25/100만 = **$1.50**

### 7. SQS + EventBridge
- 프리 티어 범위: **$0.00**

### 8. Secrets Manager (DB 1건)
- **$0.45**

### 9. SSM Parameter Store (Naver/NCP)
- Standard: **$0.00**

### 10. CloudWatch Logs (14일 보존)
- 수집 ~5GB: 처음 5GB/월 무료 → **$0.00**
- 보존 비용 (이전 수집분): **~$0.50**

### 11. SES (이메일 알림)
- 1,000 건 × $0.10/1,000 = **$0.10**

### 12. Route53
- Hosted Zone: **$0.50**

| 항목 | 비용 |
|------|------|
| NAT Instance t3.micro | $9.93 |
| RDS db.t3.micro 50GB | $25.73 |
| Lambda × 8 | $1.07 |
| API Gateway | $1.75 |
| CloudFront + S3 | $2.33 |
| DynamoDB | $1.50 |
| Secrets Manager | $0.45 |
| CloudWatch Logs | $0.50 |
| SES | $0.10 |
| Route53 | $0.50 |
| SQS / EventBridge / SSM | $0.00 |
| **합계** | **≈ $43.86/월 ✅** |

---

## 환경별 비교 요약

| 항목 | dev | prod | 비고 |
|------|-----|------|------|
| NAT | t3.nano $4.31 | t3.micro $9.93 | NAT Gateway 대비 dev -$38/월, prod -$25/월 |
| DB | db.t3.micro 20GB $21.28 | db.t3.micro 50GB $25.73 | Aurora 대비 prod -$33/월 |
| CloudWatch | 7일 $0.00 | 14일 $0.50 | |
| 기타 | ~$4.18 | ~$8.20 | |
| **월 합계** | **≈ $29.77** ✅ | **≈ $43.86** ✅ | |
| **목표** | $30 이하 | $50 이하 | |
| **여유** | **$0.23** | **$6.14** | |

---

## AWS Pricing Calculator 확인 방법

아래 URL에서 직접 산출 가능:  
https://calculator.aws/pricing/2/home?region=ap-northeast-2

**확인 권장 항목**:
1. EC2 → t3.nano / t3.micro On-Demand (ap-northeast-2)
2. RDS → PostgreSQL db.t3.micro Single-AZ (ap-northeast-2)
3. Data Transfer → NAT Instance 통과 트래픽

---

## 주의 사항

1. **prod RDS 첫 배포 시**: Aurora에서 RDS로 교체 시 기존 데이터 손실. 배포 전 스냅샷 생성 필수.
2. **RDS db.t3.micro 메모리(1GB)**: 커넥션 풀 최대 10으로 제한 권장. 트래픽 급증 시 db.t3.small 상향 고려 ($38/월 추가).
3. **NAT Instance 가용성**: NAT Gateway 대비 단일 EC2 인스턴스. prod에서 인스턴스 장애 시 인터넷 연결 단절. Auto Recovery 설정 권장.
4. **미구현 서비스 추가 시 비용 증가**: OpenSearch(~$25), ElastiCache(~$12), WebSocket API GW(~$5) 추가 예정 → 별도 예산 확보 필요.
5. **Bedrock**: 현재 CDK 미구현 상태. 월 5,000 분류 기준 ~$2 추가.
