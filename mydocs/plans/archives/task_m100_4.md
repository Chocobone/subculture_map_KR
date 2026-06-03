# 수행 계획서 — M100 #4: Bedrock 분류기 구현 및 프롬프트 튜닝

## 1. 목표

크롤러가 수집한 원본 텍스트를 AWS Bedrock(Claude Haiku)으로 분류·구조화하여
Aurora PostgreSQL의 `events` 테이블에 자동 적재한다.

현재 `handler.ts`는 DynamoDB 원본 저장까지만 구현되어 있음.
이 이슈에서 **분류기 → Aurora 저장** 흐름을 완성한다.

```
[현재]  SQS → 크롤러 → DynamoDB 원본 저장  ← 여기까지
[목표]  SQS → 크롤러 → DynamoDB 원본 저장 → Bedrock 분류 → Aurora events 저장
```

## 2. 범위

**포함**:
- `BedrockClassifier.ts` — Claude Haiku Converse API 호출, JSON 구조 추출
- `eventStorage.ts` — Aurora `events` 테이블 upsert (`source_url` 기준)
- `handler.ts` 수정 — 분류기 + eventStorage 호출 추가
- `002_add_source_url_unique.sql` — `source_url` UNIQUE 제약 추가 마이그레이션
- `CrawlerStack` 수정 — Bedrock 호출 IAM 권한, Aurora DB 환경변수 추가
- 프롬프트 튜닝 — 수동 샘플 10건으로 분류 정확도 검증

**제외**:
- 장소 좌표(place_url, place_lat, place_lng) 자동 수집 — 크롤러 경유 이벤트는 NULL 허용, API 경유(POST /events)만 좌표 채움
- S3 원본 HTML 아카이브 — 별도 백로그
- 기타 크롤러 소스(fmkorea, twitter 등) — 별도 이슈

## 3. 핵심 설계 결정

### 3-1. Bedrock 모델

| 항목 | 결정 |
|------|------|
| 모델 | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| API | Bedrock Converse API (InvokeModel 대신 — 스트리밍 불필요, 응답 파싱 단순) |
| 리전 | `ap-northeast-2` (서울) — 지원 여부 확인 필요, 미지원 시 `us-east-1` cross-region |
| 비용 기준 | 입력 $0.08/MTok, 출력 $0.4/MTok (Claude 3.5 Haiku) |

### 3-2. 분류 프롬프트 전략

- **입력 상한**: 게시글 텍스트 최대 2,000자 (토큰 비용 제어)
- **출력 형식**: JSON 단일 객체 (마크다운 코드블록 없이)
- **행사 없음 판단**: `null` 반환 → Aurora 저장 건너뜀
- **한국어 프롬프트**: 서브컬처 도메인 특화 (팝업/콜라보/굿즈/한정 4가지 유형)

```
당신은 서브컬처(애니·게임) 행사 정보 추출기입니다.
IP명: "{ipName}"

다음 텍스트에서 해당 IP의 팝업스토어·콜라보·굿즈샵·한정 행사 정보를 추출하세요.
행사 정보가 없으면 null을 반환하세요.

반드시 아래 JSON 형식만 반환합니다 (마크다운 불가):
{"title":"","type":"popup|collab|goods|limited","place":"","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","summary":""}

텍스트:
{text}
```

### 3-3. Aurora upsert 전략

`source_url`에 UNIQUE 제약을 추가하여 `ON CONFLICT (source_url) DO UPDATE`로 처리.
재크롤링 시 분류 결과가 갱신되도록 title, type, place, summary 필드를 업데이트.

```sql
-- 002_add_source_url_unique.sql
ALTER TABLE events ADD CONSTRAINT events_source_url_unique UNIQUE (source_url);
```

### 3-4. 크롤러 Lambda → Aurora 직접 연결

크롤러 Lambda는 이미 VPC Private Subnet에 있음.
API 핸들러의 `db/client.ts` 동일 패턴으로 Aurora 연결 (Secrets Manager 경유).
환경변수 `DB_SECRET_ARN`, `DB_HOST`, `DB_NAME`을 CrawlerStack에 추가.

## 4. 구현 단계 (구현 계획서에서 상세화)

1. `BedrockClassifier.ts` 구현 + 단위 테스트
2. `eventStorage.ts` 구현 + 마이그레이션 SQL
3. `handler.ts` 수정 — 분류기·eventStorage 연동
4. `CrawlerStack` 수정 — Bedrock IAM + Aurora 환경변수
5. `cdk synth` 검증 + 프롬프트 튜닝 (샘플 10건)

## 5. 완료 기준

- `npm run test` 전체 통과 (BedrockClassifier 단위 테스트 포함)
- `cdk synth` 오류 없음
- 수동 샘플 10건 분류 정확도 ≥ 80% (유형·날짜 기준)
- handler.ts 통합 실행 시 DynamoDB 저장 + Aurora 저장 모두 확인

## 6. 작업지시자 승인 요청

위 계획으로 진행해도 될까요?

**확인이 필요한 사전 결정 사항**:
1. **Bedrock 모델**: `claude-3-5-haiku` 사용 여부 (비용 대비 정확도 tradeoff)
2. **ap-northeast-2 지원**: 서울 리전 Bedrock에서 Claude 3.5 Haiku 사용 가능 여부 확인 요청
3. **place 좌표 처리**: 크롤러 경유 이벤트는 place_url/lat/lng NULL 허용 (범위에서 제외) 동의 여부
