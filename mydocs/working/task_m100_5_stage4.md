# Stage 4 완료 보고서 — M100 #5: CrawlerStack 수정 + 전체 테스트 + cdk synth

## 완료 일시
2026-06-03

## 작업 내용

### 수정된 파일
- `infra/lib/stacks/crawler-stack.ts`

### 변경 내용

**환경변수 추가**:
```typescript
environment: {
  DYNAMO_TABLE:     rawTable.tableName,      // 기존
  DB_SECRET_ARN:    dbSecret.secretArn,      // 신규
  DB_HOST:          aurora.clusterEndpoint.hostname, // 신규
  DB_NAME:          'subculture_tracker',    // 신규
  NAVER_SECRET_ARN: naverApiSecret.secretArn, // 신규
},
```

**IAM 권한 추가**:
```typescript
dbSecret.grantRead(crawlerFn);       // Aurora 크리덴셜 읽기
naverApiSecret.grantRead(crawlerFn); // Naver API 크리덴셜 읽기
```

**보안 그룹 인그레스 추가**:
```typescript
network.dbSg.addIngressRule(
  network.lambdaSg, Port.tcp(5432), 'Crawler Lambda → Aurora'
);
```

### 검증 결과

```
jest (crawler): 14/14 통과 ✅
tsc --noEmit (infra): 오류 없음 ✅
cdk synth SubcultureTracker-Crawler-dev: CloudFormation 템플릿 정상 생성 ✅
```

**비고**: `cdk synth --all` 실행 시 `backend/api` 의존성 미설치로 API 스택 번들링 실패.
api 패키지 `npm install` 후 해소. Crawler 스택 자체는 정상.

## 완료 기준 충족 여부

| 기준 | 결과 |
|------|------|
| `npm test` (crawler) 전체 통과 | ✅ 14/14 |
| `tsc --noEmit` 오류 없음 (infra) | ✅ |
| `cdk synth SubcultureTracker-Crawler-dev` 오류 없음 | ✅ |
