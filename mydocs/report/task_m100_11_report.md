# 최종 결과 보고서 — Task M100 #11
## 인프라 비용 최적화: dev $30/월 · prod $50/월

> 완료일: 2026-06-05  
> 브랜치: `local/task11`  
> Issue: [#11](https://github.com/Chocobone/subculture_map_KR/issues/11)

---

## 목표 달성 여부

| 환경 | 목표 | 결과 | 달성 |
|------|------|------|------|
| dev | $30 이하 / 월 | **~$29.77/월** | ✅ |
| prod | $50 이하 / 월 | **~$43.86/월** | ✅ |

---

## 구현 완료 단계

| Stage | 내용 | 변경 파일 |
|-------|------|-----------|
| 1 | NAT Instance 교체: dev t3.nano / prod t3.micro | `data-stack.ts`, `VpcNetwork.ts` |
| 2 | prod DB: Aurora Serverless v2 → RDS db.t3.micro (50GB, 7일 백업) | `data-stack.ts` |
| 3 | logRetention 환경별 분기: dev 7일 / prod 14일 | `api-stack.ts`, `crawler-stack.ts` |
| 4 | 비용 추정 문서 업데이트 | `aws_cost_estimate.md` |
| 5 | 배포 방법 문서 재작성 (dev/prod 분리) | `orders/20260605.md` |

---

## 최종 인프라 구성

| 항목 | dev | prod |
|------|-----|------|
| NAT | NatInstanceProviderV2 **t3.nano** (AL2023) | NatInstanceProviderV2 **t3.micro** (AL2023) |
| DB | RDS PostgreSQL **db.t3.micro**, 20GB, 1일 백업 | RDS PostgreSQL **db.t3.micro**, 50GB, 7일 백업 |
| CloudWatch 로그 보존 | 7일 | 14일 |
| RemovalPolicy | DESTROY | RETAIN |
| 자격증명 | SSM Parameter Store (Naver/NCP) + Secrets Manager (DB) | 동일 |

---

## 비용 변화 요약

### dev 환경

| 항목 | 변경 전 | 변경 후 | 절감 |
|------|---------|---------|------|
| NAT | NAT Gateway ~$42.78 | t3.nano ~$4.31 | **-$38.47** |
| DB | RDS t3.micro (기존 유지) | 동일 | $0 |
| **월 합계** | **~$90/월** | **~$29.77/월** | **-$60/월** |

### prod 환경

| 항목 | 변경 전 | 변경 후 | 절감 |
|------|---------|---------|------|
| NAT | NAT Gateway ~$42.78 | t3.micro ~$9.93 | **-$32.85** |
| DB | Aurora Serverless v2 ~$45.20 | RDS t3.micro ~$25.73 | **-$19.47** |
| **월 합계** | **~$100/월** | **~$43.86/월** | **-$56/월** |

---

## 검증 결과

- `infra npx tsc --noEmit` — **오류 0건** (전 단계)

---

## 주의 사항 (운영 시 인지 필요)

1. **prod 첫 배포 전** Aurora → RDS 교체로 기존 데이터 재생성 필요. 스냅샷 생성 필수.
2. **NAT Instance 단일 장애점**: NAT Gateway 대비 가용성 낮음. prod에서 EC2 Auto Recovery 설정 권장.
3. **db.t3.micro 커넥션 제한**: 메모리 1GB. 커넥션 풀 max 10 권장. 트래픽 증가 시 db.t3.small 검토 (월 +$13).
4. **미구현 서비스 추가 시**: OpenSearch·ElastiCache 추가 시 prod 예산 $50 초과 가능. 별도 검토 필요.
