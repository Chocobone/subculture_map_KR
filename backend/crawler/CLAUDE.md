# Backend / Crawler — Claude Code Guide

SQS 트리거 기반 크롤러 워커 Lambda입니다. 소스별로 전용 크롤러 모듈을 가집니다.

> **Hyper-Waterfall 적용**: 새 크롤링 소스 추가 또는 기존 소스 수정 전 반드시 수행 계획서를 작성하고 승인을 받아야 합니다.

---

## 디렉토리 구조

```
backend/crawler/src/
├── handler.ts                ← SQS 트리거 핸들러 (진입점)
├── crawlers/
│   ├── BaseCrawler.ts        ← 공통 인터페이스
│   ├── TwitterCrawler.ts     ← Twitter API v2
│   ├── RuliwwebCrawler.ts    ← 루리웹 HTML 파싱 (Cheerio)
│   ├── FMKoreaCrawler.ts     ← 에펨코리아 HTML 파싱
│   ├── NaverCafeCrawler.ts   ← 네이버 카페 RSS
│   ├── DcinsideCrawler.ts    ← 디시인사이드 갤러리
│   └── crawlerFactory.ts     ← 소스 키 → 크롤러 인스턴스 매핑
├── classifier/
│   └── BedrockClassifier.ts  ← Claude Haiku로 행사 분류·추출
├── storage/
│   ├── rawStorage.ts         ← DynamoDB + S3 원본 저장, 중복 URL 감지
│   └── eventStorage.ts       ← Aurora 행사 데이터 upsert
└── utils/
    ├── dedup.ts              ← 중복 URL MD5 해시
    └── rateLimit.ts          ← 소스별 요청 속도 제한
```

---

## 핵심 패턴

### SQS 핸들러 (진입점)

```typescript
// handler.ts
import { SQSHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { crawlerFactory } from './crawlers/crawlerFactory';
import { BedrockClassifier } from './classifier/BedrockClassifier';
import { rawStorage } from './storage/rawStorage';
import { eventStorage } from './storage/eventStorage';

const logger = new Logger({ serviceName: 'crawler-worker' });
const classifier = new BedrockClassifier();

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const { ipName, source, keywords } = JSON.parse(record.body);
    logger.info('크롤링 시작', { ipName, source });

    const crawler = crawlerFactory(source);
    const rawItems = await crawler.fetch(keywords);

    for (const raw of rawItems) {
      // 1. 중복 체크 (DynamoDB urlHash)
      if (await rawStorage.isDuplicate(raw.url)) continue;

      // 2. 원본 저장
      await rawStorage.save(raw);

      // 3. Bedrock으로 분류·구조화
      const classified = await classifier.classify(raw.text, ipName);
      if (!classified) continue;

      // 4. Aurora에 행사 upsert
      await eventStorage.upsert({ ...classified, ipName, sourceUrl: raw.url });
    }
  }
};
```

### 크롤러 기본 인터페이스

```typescript
// crawlers/BaseCrawler.ts
export interface RawItem {
  url:       string;
  text:      string;
  htmlPath?: string;   // S3 저장 경로 (선택)
  crawledAt: string;   // ISO 8601
}

export abstract class BaseCrawler {
  abstract fetch(keywords: string[]): Promise<RawItem[]>;

  protected buildSearchQuery(keywords: string[]): string {
    // "(원피스 OR OP) AND (팝업 OR 콜라보 OR 굿즈 OR 한정)"
    return `(${keywords.map(k => `"${k}"`).join(' OR ')}) AND (팝업 OR 콜라보 OR 굿즈 OR 한정)`;
  }
}
```

### Bedrock 분류기 (Claude Haiku)

```typescript
// classifier/BedrockClassifier.ts
export interface ClassifiedEvent {
  title:     string;
  type:      'popup' | 'collab' | 'goods' | 'limited';
  place:     string;
  startDate: string;   // YYYY-MM-DD 또는 빈 문자열
  endDate:   string;
  summary:   string;
}

// 프롬프트 핵심: JSON만 반환하도록 지시
const PROMPT = (text: string, ipName: string) => `
당신은 서브컬쳐 행사 정보 추출기입니다.
다음 텍스트에서 "${ipName}" 관련 팝업스토어·콜라보·굿즈·한정 행사 정보를 추출하세요.
행사 정보가 없으면 null을 반환하세요.

응답은 반드시 아래 JSON 형식만 반환합니다 (마크다운 코드블록 없이):
{"title":"","type":"popup|collab|goods|limited","place":"","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","summary":""}

텍스트:
${text.slice(0, 2000)}
`;
// Claude Haiku 사용 이유: 비용 최소화 ($0.25/MTok 입력)
```

### 크롤러 팩토리

```typescript
// crawlers/crawlerFactory.ts
import type { CrawlSource } from '../../../../shared/types';

export function crawlerFactory(source: CrawlSource): BaseCrawler {
  switch (source) {
    case 'ruliweb':    return new RuliwwebCrawler();
    case 'fmkorea':    return new FMKoreaCrawler();
    case 'twitter':    return new TwitterCrawler();
    case 'naver-cafe': return new NaverCafeCrawler();
    case 'dcinside':   return new DcinsideCrawler();
    default: throw new Error(`알 수 없는 소스: ${source}`);
  }
}
```

---

## SQS 메시지 형식

EventBridge가 매 1시간마다 아래 형식의 메시지를 SQS에 발행합니다:

```json
{
  "ipId":     "uuid",
  "ipName":   "원피스",
  "source":   "ruliweb",
  "keywords": ["원피스", "OP", "One Piece"]
}
```

IP × 소스 조합별로 메시지가 분리되어 병렬 처리됩니다.

---

## 환경 변수

```bash
SQS_QUEUE_URL=https://sqs.ap-northeast-2.amazonaws.com/.../crawler-queue
DYNAMO_TABLE=crawler-raw-items
S3_RAW_BUCKET=subculture-tracker-raw
DB_SECRET_ARN=arn:aws:secretsmanager:...
TWITTER_BEARER_TOKEN_SECRET_ARN=arn:aws:secretsmanager:...
AWS_REGION=ap-northeast-2
```

---

## 새 크롤링 소스 추가 시 절차 (Hyper-Waterfall)

**반드시 아래 4단계를 순서대로 진행하고 각 단계마다 승인을 받아야 합니다:**

1. GitHub Issue 등록 (소스명, 수집 방식, 예상 응답 구조 명시)
2. `mydocs/plans/task_{m}_{N}.md` 수행 계획서 작성 → 승인
3. `mydocs/plans/task_{m}_{N}_impl.md` 구현 계획서 작성 (아래 4개 파일 명시) → 승인
   - `crawlers/NewSourceCrawler.ts` 신규 생성
   - `crawlers/crawlerFactory.ts` 소스 키 추가
   - `utils/rateLimit.ts` 속도 제한 설정 추가
   - `infra/lib/stacks/crawler-stack.ts` SQS 소스 목록 업데이트
4. 단계별 구현 → 보고 → 승인 → 최종 보고

---

## 트러블슈팅

크롤링 관련 이슈 발생 시 아래 순서로 진단합니다:

1. **CloudWatch Logs**: Lambda 실행 로그 확인 (PowerTools Logger 출력)
2. **DynamoDB 확인**: 원본 텍스트가 `crawler-raw-items` 테이블에 저장됐는지 확인
3. **Bedrock 응답**: classifier 로그에서 Claude Haiku 응답 JSON 확인
4. **SQS DLQ 확인**: 3회 실패한 메시지가 DLQ에 쌓였는지 확인

트러블슈팅 기록: `mydocs/troubleshootings/` 폴더에 작성
