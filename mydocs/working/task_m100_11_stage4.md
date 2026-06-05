# Stage 4 완료 보고서 — Task M100 #11
## aws_cost_estimate.md 비용 추정 문서 업데이트

> 완료일: 2026-06-05  
> 브랜치: `local/task11`

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `mydocs/tech/aws_cost_estimate.md` | Task #11 인프라 기준으로 전면 재작성 |

---

## 주요 변경 내용

### 문서 구조 변경

| 변경 전 | 변경 후 |
|---------|---------|
| 단일 환경(dev) 기준 서비스별 나열 | dev / prod 환경 분리 상세 산출 |
| Aurora Serverless v2, NAT Gateway 기준 | RDS db.t3.micro, NAT Instance 기준 |
| 비용 절감 포인트 섹션 | AWS Pricing Calculator 확인 방법 추가 |

### 최종 비용 요약

| 환경 | 합계 | 목표 | 여유 |
|------|------|------|------|
| dev | **~$29.77/월** | $30 이하 | $0.23 |
| prod | **~$43.86/월** | $50 이하 | $6.14 |

### 구버전 대비 절감액

| 항목 | 구버전 | 신버전 | 절감 |
|------|--------|--------|------|
| NAT (dev) | NAT Gateway ~$42.78 | t3.nano ~$4.31 | -$38.47 |
| NAT (prod) | NAT Gateway ~$42.78 | t3.micro ~$9.93 | -$32.85 |
| DB (prod) | Aurora ~$45.20 | RDS ~$25.73 | -$19.47 |

---

*Stage 5 진행 대기 — 작업지시자 승인 요청*
