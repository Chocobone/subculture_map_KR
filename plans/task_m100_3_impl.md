# 구현 계획서 — M100 #3: 루리웹 크롤러 구현

## 개요

| 항목 | 내용 |
|------|------|
| 이슈 | #3 |
| 마일스톤 | M100 |
| 수행 계획서 | `plans/task_m100_3.md` |
| 브랜치 | `local/task3` |
| 단계 수 | 6단계 (테스트 Stage 6에서 일괄 진행) |

---

## 단계별 구현 계획

### Stage 1 — 패키지 초기 설정

**생성 파일**:
```
backend/crawler/
├── package.json         ← Cheerio, axios, @aws-sdk/*, @aws-lambda-powertools
├── tsconfig.json        ← rootDir 미지정, include에 ../../shared/**/* 포함
└── .env.example
```

**완료 기준**: `npm install` 완료, `tsc --noEmit` 오류 없음

---

### Stage 2 — BaseCrawler + RuliwwebCrawler 구현

**생성 파일**:
```
backend/crawler/src/
├── crawlers/
│   ├── BaseCrawler.ts        ← RawItem 타입 + abstract fetch()
│   ├── RuliwwebCrawler.ts    ← Cheerio 파싱, axios HTTP
│   └── crawlerFactory.ts     ← source 키 → 크롤러 인스턴스
└── utils/
    └── dedup.ts              ← URL MD5 해시
```

**루리웹 크롤링 상세**:
- URL: `https://bbs.ruliweb.com/search?q={query}&r=content`
- 파싱: `table.board_list_table tbody tr` → `td.subject a.deco` (제목/URL)
- 요청 간격: 1초 (rate limit 준수)

**완료 기준**: TypeScript 타입 오류 없음

---

### Stage 3 — rawStorage (DynamoDB 원본 저장)

**생성 파일**:
```
backend/crawler/src/
└── storage/
    └── rawStorage.ts    ← DynamoDB put + urlHash 중복 체크
```

**DynamoDB 스키마**:
- 테이블: `crawler-raw-items-{env}`
- PK: `urlHash` (STRING, MD5 of URL)
- Attributes: `url`, `text`, `source`, `crawledAt`, `ipId`

**완료 기준**: TypeScript 타입 오류 없음

---

### Stage 4 — SQS 핸들러 구현

**생성 파일**:
```
backend/crawler/src/
└── handler.ts    ← SQSHandler — 메시지 파싱 → 크롤링 → 저장
```

**처리 흐름**:
```
SQS 메시지 { ipId, ipName, source, keywords }
  → crawlerFactory(source)
  → crawler.fetch(keywords) → RawItem[]
  → rawStorage.isDuplicate(url)? skip : rawStorage.save()
```

Bedrock 분류 호출은 Issue #4에서 추가.

**완료 기준**: TypeScript 타입 오류 없음

---

### Stage 5 — CDK CrawlerStack + infra 연동

**생성 파일**:
```
infra/lib/stacks/
└── crawler-stack.ts    ← SQS Queue + Lambda + DynamoDB + EventBridge Rule
```

**수정 파일**:
```
infra/bin/app.ts        ← CrawlerStack 추가
infra/lib/stacks/data-stack.ts  ← rawTable 추가
```

**완료 기준**: `npx cdk synth` 오류 없음

---

### Stage 6 — SAM 로컬 테스트 준비

**생성 파일**:
```
backend/crawler/
├── template.yaml
└── events/
    └── crawlRuliweb.json    ← 원피스 키워드 SQS 이벤트
```

**완료 기준**: template.yaml 작성 완료, 이벤트 JSON 작성 완료
(실제 SAM 실행은 통합 테스트 Phase에서 일괄 진행)

---

## 파일 생성 요약

| Stage | 신규 파일 수 | 내용 |
|-------|------------|------|
| 1 | 3 | 패키지 초기 설정 |
| 2 | 4 | 크롤러 구현 |
| 3 | 1 | DynamoDB 저장 |
| 4 | 1 | SQS 핸들러 |
| 5 | 1(+수정 2) | CDK CrawlerStack |
| 6 | 2 | SAM 준비 |
| **합계** | **12** | |
