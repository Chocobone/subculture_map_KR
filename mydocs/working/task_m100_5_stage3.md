# Stage 3 완료 보고서 — M100 #5: db/client.ts + eventStorage.ts + handler.ts + 마이그레이션 SQL

## 완료 일시
2026-06-03

## 작업 내용

### 생성/수정된 파일
- `backend/crawler/src/db/client.ts` — 신규 (api 패키지 동일 패턴)
- `backend/crawler/src/storage/eventStorage.ts` — 신규
- `backend/crawler/src/handler.ts` — popga 분기 추가
- `backend/api/src/db/migrations/002_add_source_url_unique.sql` — 신규
- `backend/crawler/package.json` — `pg`, `@types/pg` 추가

### 구현 사항

**db/client.ts**:
- `getPool()`: Lambda 컨테이너 재사용을 위한 Pool 싱글턴
- 로컬: `DB_PASSWORD` 환경변수 직접 사용
- AWS: `DB_SECRET_ARN`으로 Secrets Manager에서 크리덴셜 로드

**eventStorage.ts**:
- `upsert()`: `ON CONFLICT (source_url) DO UPDATE` 처리
- 좌표 포함 저장: `place_lat`, `place_lng`, `place_url`
- `fromPlaceInfo()`: `PlaceInfo | null` → upsert 파라미터 변환 헬퍼

**handler.ts 변경 내용**:
```typescript
// source 타입 CrawlSource로 명시화
// popga 소스 처리 분기 추가:
if (source === 'popga') {
  const structured = JSON.parse(raw.text);
  const coords = await searchPlace(structured.place);
  await eventStorage.upsert({ ...structured, ipId, sourceUrl: raw.url, ...coords });
}
// 그 외 소스는 Issue #4에서 Bedrock 연동 예정
```

**마이그레이션 SQL**:
```sql
ALTER TABLE events ADD CONSTRAINT events_source_url_unique UNIQUE (source_url);
```

**비고**: `db/client.ts`와 `eventStorage.ts`는 Issue #4(Bedrock 분류기)에서도 재사용 가능.

### 검증 결과

```
TypeScript tsc --noEmit: 오류 없음 ✅
jest: 14/14 통과 ✅
```

## 다음 단계

Stage 4: CrawlerStack 수정 + 전체 테스트 + cdk synth
