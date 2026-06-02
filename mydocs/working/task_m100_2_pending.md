# M100 #2 미완료 항목 — Aurora 스키마 마이그레이션 + Lambda API CRUD

> Issue #2 클로즈 후 이관된 미완료 항목 (2026-06-02)
> 원본 보고서: `mydocs/report/task_m100_2_report.md`

---

## 미완료 항목

### P1 — dev 스택 배포 (작업지시자 수행)

| 순서 | 명령 | 비고 |
|------|------|------|
| 1 | `aws sts get-caller-identity` | IAM 자격증명 확인 |
| 2 | `cd infra && npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-2` | 최초 1회 |
| 3 | `npx cdk deploy SubcultureTracker-Data-dev --context env=dev` | Aurora, Redis, DynamoDB, Naver API Secret |
| 4 | Naver API 시크릿 수동 입력 | AWS Console → Secrets Manager → `subculture-tracker/naver-api` → 값 편집 |
| 5 | Aurora 마이그레이션 적용 | Aurora 클러스터에 `001_initial_schema.sql` 실행 |
| 6 | `npx cdk deploy SubcultureTracker-Api-dev --context env=dev` | API Gateway + Lambda 7개 |
| 7 | CloudWatch Logs 확인 | Lambda 기동 오류 없음 확인 |

### P2 — dev 환경 E2E 테스트 (배포 후)

| 엔드포인트 | 확인 항목 |
|-----------|-----------|
| `POST /events` (place 있음) | Aurora에 `place_url`, `place_lat`, `place_lng` 저장 확인 |
| `GET /events/{id}` | 응답 JSON에 세 필드 포함 확인 |
| `POST /events` (place 없음) | 세 필드 NULL, 201 정상 반환 |
| Naver API 미발견 장소 | 세 필드 NULL, 에러 없음 |

### P3 — Naver placeUrl 빈 문자열 처리 개선 (백로그)

**현상**: Naver Local Search API가 일부 장소(홍대입구역 등)에 대해 `link` 필드를 빈 문자열로 반환.
현재 코드는 빈 문자열을 그대로 저장하여 DB에 `""` 가 들어감.

**개선 방향**: `naverMapsService.ts`에서 `item.link || null` 처리 추가 → `placeUrl`이 NULL로 저장되도록.

```typescript
// 현재
placeUrl: item.link,
// 개선
placeUrl: item.link || null,
```

**우선순위**: 낮음 (기능 동작에는 영향 없음, 데이터 일관성 개선)

---

## Naver API 실제 검증 결과 (2026-06-02)

| 항목 | 결과 |
|------|------|
| API 호출 성공 | ✅ |
| 장소: 홍대입구역 | |
| `placeLat` | 37.5577188 ✅ (한국 범위 33~38 이내) |
| `placeLng` | 126.9265991 ✅ (한국 범위 124~132 이내) |
| `placeUrl` | `""` (Naver API가 해당 장소 link 미제공 — P3 참조) |

---

## 연관 백로그

- B-002: ElastiCache 캐시 무효화 전략 개선
- B-004 (신규): `naverMapsService` placeUrl 빈 문자열 → null 처리
