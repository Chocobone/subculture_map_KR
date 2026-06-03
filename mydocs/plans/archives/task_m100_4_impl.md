# 구현 계획서 — M100 #4: Bedrock 분류기 구현 및 프롬프트 튜닝

## 전제 조건

수행 계획서 `task_m100_4.md` 승인 완료.

현재 상태:
- `handler.ts`: DynamoDB 원본 저장까지만 구현 (분류기 미연동)
- `BedrockClassifier.ts`, `eventStorage.ts`, `db/client.ts`: 미존재
- `CrawlerStack`: Bedrock IAM 권한, Aurora 환경변수 미설정

---

## 단계별 구현 계획

### Stage 1 — BedrockClassifier.ts 구현 + 단위 테스트

**생성/수정 파일**:
- `backend/crawler/src/classifier/BedrockClassifier.ts` — 신규 생성
- `backend/crawler/src/__tests__/BedrockClassifier.test.ts` — 신규 생성
- `backend/crawler/package.json` — `@aws-sdk/client-bedrock-runtime` 의존성 추가

**구현 내용**:

```typescript
// BedrockClassifier.ts
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { Logger } from '@aws-lambda-powertools/logger';

export interface ClassifiedEvent {
  title:     string;
  type:      'popup' | 'collab' | 'goods' | 'limited';
  place:     string;
  startDate: string;
  endDate:   string;
  summary:   string;
}

const MODEL_ID = 'anthropic.claude-3-5-haiku-20241022-v1:0';
const MAX_TEXT  = 2000;

export class BedrockClassifier {
  private client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
  private logger = new Logger({ serviceName: 'BedrockClassifier' });

  async classify(text: string, ipName: string): Promise<ClassifiedEvent | null> {
    const prompt = `당신은 서브컬처(애니·게임) 행사 정보 추출기입니다.\n` +
      `IP명: "${ipName}"\n\n` +
      `다음 텍스트에서 해당 IP의 팝업스토어·콜라보·굿즈샵·한정 행사 정보를 추출하세요.\n` +
      `행사 정보가 없으면 null을 반환하세요.\n\n` +
      `반드시 아래 JSON 형식만 반환합니다 (마크다운 불가):\n` +
      `{"title":"","type":"popup|collab|goods|limited","place":"","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","summary":""}\n\n` +
      `텍스트:\n${text.slice(0, MAX_TEXT)}`;

    const res = await this.client.send(new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 300, temperature: 0 },
    }));

    const raw = (res.output?.message?.content?.[0] as { text: string })?.text?.trim() ?? '';
    this.logger.debug('Bedrock 응답', { raw });

    if (raw === 'null' || raw === '') return null;

    try {
      return JSON.parse(raw) as ClassifiedEvent;
    } catch {
      this.logger.warn('JSON 파싱 실패 — null 처리', { raw });
      return null;
    }
  }
}
```

**단위 테스트** (`BedrockClassifier.test.ts`):
- BedrockRuntimeClient mock 처리
- 정상 분류 응답 → ClassifiedEvent 반환 검증
- `null` 응답 → null 반환 검증
- JSON 파싱 실패 → null 반환 검증 (warn 로그 기록)

**완료 기준**: `npm test` 전체 통과 (3개 케이스)

---

### Stage 2 — eventStorage.ts + db/client.ts + 마이그레이션 SQL

**생성/수정 파일**:
- `backend/crawler/src/db/client.ts` — 신규 생성 (api의 `db/client.ts` 동일 패턴)
- `backend/crawler/src/storage/eventStorage.ts` — 신규 생성
- `backend/api/src/db/migrations/002_add_source_url_unique.sql` — 신규 생성
- `backend/crawler/package.json` — `pg`, `@aws-sdk/client-secrets-manager` 의존성 추가

**구현 내용**:

```sql
-- 002_add_source_url_unique.sql
-- source_url UNIQUE 제약 추가 (upsert 기준)
ALTER TABLE events
  ADD CONSTRAINT events_source_url_unique UNIQUE (source_url);
```

```typescript
// eventStorage.ts
import { getPool } from '../db/client';
import { ClassifiedEvent } from '../classifier/BedrockClassifier';

interface UpsertParams extends ClassifiedEvent {
  ipId:      string;
  sourceUrl: string;
}

export const eventStorage = {
  async upsert(params: UpsertParams): Promise<void> {
    const pool = await getPool();
    await pool.query(`
      INSERT INTO events (ip_id, title, type, place, start_date, end_date, source_url, summary, status)
      VALUES ($1, $2, $3, $4,
              NULLIF($5, '')::date, NULLIF($6, '')::date,
              $7, $8, 'upcoming')
      ON CONFLICT (source_url) DO UPDATE SET
        title      = EXCLUDED.title,
        type       = EXCLUDED.type,
        place      = EXCLUDED.place,
        start_date = EXCLUDED.start_date,
        end_date   = EXCLUDED.end_date,
        summary    = EXCLUDED.summary,
        updated_at = now()
    `, [
      params.ipId, params.title, params.type, params.place,
      params.startDate, params.endDate, params.sourceUrl, params.summary,
    ]);
  },
};
```

**완료 기준**: `npm test` 전체 통과, 마이그레이션 SQL 문법 검증

---

### Stage 3 — handler.ts 수정 (분류기·eventStorage 연동)

**수정 파일**:
- `backend/crawler/src/handler.ts`

**변경 내용**: 기존 DynamoDB 저장 이후 Bedrock 분류 → Aurora upsert 흐름 추가

```typescript
// handler.ts (수정 후 골격)
import { BedrockClassifier } from './classifier/BedrockClassifier';
import { eventStorage }      from './storage/eventStorage';

const classifier = new BedrockClassifier(); // 컨테이너 재사용 최적화

// 기존 rawStorage.save() 이후 추가:
const classified = await classifier.classify(raw.text, ipName);
if (!classified) {
  logger.info('행사 정보 없음 — Aurora 저장 건너뜀', { url: raw.url });
  continue;
}
await eventStorage.upsert({ ...classified, ipId, sourceUrl: raw.url });
logger.info('Aurora 행사 저장 완료', { url: raw.url, title: classified.title });
```

**완료 기준**: TypeScript 컴파일 오류 없음, `npm test` 통과

---

### Stage 4 — CrawlerStack 수정 (Bedrock IAM + Aurora 환경변수)

**수정 파일**:
- `infra/lib/stacks/crawler-stack.ts`

**변경 내용**:

```typescript
// DataStack에서 전달받는 aurora, dbSecret 사용
const { network, rawTable, aurora, dbSecret } = dataStack;

// environment 추가
environment: {
  DYNAMO_TABLE:   rawTable.tableName,
  DB_SECRET_ARN:  dbSecret.secretArn,
  DB_HOST:        aurora.clusterEndpoint.hostname,
  DB_NAME:        'subculture_tracker',
  AWS_REGION:     this.region,
},

// Bedrock 호출 IAM 정책 추가
crawlerFn.addToRolePolicy(new PolicyStatement({
  actions:   ['bedrock:InvokeModel'],
  resources: [`arn:aws:bedrock:${this.region}::foundation-model/${MODEL_ID}`],
}));

// Aurora 시크릿 읽기 권한
dbSecret.grantRead(crawlerFn);

// Aurora 보안 그룹 인그레스 (Lambda → Aurora)
network.dbSg.addIngressRule(
  network.lambdaSg,
  Port.tcp(5432),
  'Crawler Lambda → Aurora',
);
```

**완료 기준**: `npx cdk synth` 오류 없음

---

### Stage 5 — cdk synth 검증 + 프롬프트 튜닝 (샘플 10건)

**작업 내용**:

1. **`npx cdk synth --all --context env=dev`** 실행 → CloudFormation 템플릿 오류 없음 확인
2. **프롬프트 튜닝**: `mydocs/tech/bedrock_prompt_tuning.md`에 샘플 10건 분류 결과 기록
   - 팝업스토어 3건, 콜라보 3건, 굿즈 2건, 한정 1건, 행사 없음 1건
   - 각 샘플: 입력 텍스트 → 예상 출력 → 실제 Bedrock 응답 → 판정(O/X)
   - 목표: 유형·날짜 기준 분류 정확도 ≥ 80%
3. **전체 테스트**: `npm run test -ws` 통과 확인

**완료 기준**:
- `cdk synth` 오류 없음
- 샘플 10건 중 8건 이상 정확 분류 (80%)
- `npm run test -ws` 전체 통과

---

## 파일 변경 요약

| 파일 | 작업 | 단계 |
|------|------|------|
| `backend/crawler/src/classifier/BedrockClassifier.ts` | 신규 | Stage 1 |
| `backend/crawler/src/__tests__/BedrockClassifier.test.ts` | 신규 | Stage 1 |
| `backend/crawler/package.json` | 의존성 추가 | Stage 1, 2 |
| `backend/crawler/src/db/client.ts` | 신규 | Stage 2 |
| `backend/crawler/src/storage/eventStorage.ts` | 신규 | Stage 2 |
| `backend/api/src/db/migrations/002_add_source_url_unique.sql` | 신규 | Stage 2 |
| `backend/crawler/src/handler.ts` | 수정 | Stage 3 |
| `infra/lib/stacks/crawler-stack.ts` | 수정 | Stage 4 |
| `mydocs/tech/bedrock_prompt_tuning.md` | 신규 | Stage 5 |

---

## 작업지시자 승인 요청

위 5단계 구현 계획으로 진행해도 될까요?

**확인 요청 사항**:
1. **Bedrock 모델 ID**: `anthropic.claude-3-5-haiku-20241022-v1:0` 사용 여부
   - ap-northeast-2(서울) 미지원 시 `us-east-1` cross-region inference 프로파일 사용 예정
2. **Aurora 연결 포트**: 5432 (PostgreSQL 기본값) 사용 여부
3. **Stage 5 프롬프트 튜닝**: 실제 Bedrock API 호출이 필요하므로 AWS 크리덴셜 확인 필요
