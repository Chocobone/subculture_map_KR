# 수행 계획서 — M100 #3: 루리웹 크롤러 구현

## 1. 목표

루리웹(ruliweb.com) 게시판을 Cheerio로 파싱하여 서브컬쳐 행사 관련 게시물을 수집하는 Lambda 크롤러를 구현한다. SQS 메시지로 IP·키워드를 전달받아 관련 게시물 URL·본문을 추출한 후 DynamoDB에 원본 저장한다.

## 2. 범위

- **포함**:
  - `backend/crawler` 패키지 초기 설정 (package.json, tsconfig.json)
  - `BaseCrawler` 추상 클래스
  - `RuliwwebCrawler` — Cheerio 기반 HTML 파싱
  - `crawlerFactory` — 소스 키 → 크롤러 인스턴스 매핑
  - `rawStorage` — DynamoDB 원본 저장 + 중복 URL 감지 (MD5 해시)
  - SQS 핸들러 (`handler.ts`)
  - CDK `CrawlerStack` — Lambda + SQS + DynamoDB + EventBridge 규칙
  - SAM 로컬 테스트 템플릿
- **제외**:
  - Bedrock 분류기 (Issue #4에서 구현)
  - `eventStorage` (Aurora upsert) — Bedrock 분류 결과 필요하므로 Issue #4와 함께
  - Twitter, FMKorea, NaverCafe, Dcinside 크롤러 (이후 이슈에서 순차 구현)

## 3. 루리웹 크롤링 방식

루리웹 애니·게임 게시판에서 키워드 검색 결과를 수집한다.

**검색 URL**: `https://bbs.ruliweb.com/search?q={encoded_query}&board_id=&r=content`

**파싱 대상 (Cheerio 셀렉터)**:
```
게시물 목록: table.board_list_table tbody tr
  제목: td.subject a.deco
  URL: td.subject a.deco[href]
  날짜: td.time
```

**요청 설정**:
- `User-Agent`: 일반 브라우저 UA 문자열
- 검색 쿼리: `(원피스 OR OP) AND (팝업 OR 콜라보 OR 굿즈 OR 한정)` 형식
- 결과 수: 최대 20건/호출 (페이지 1만)

## 4. 구현 단계

1. 패키지 초기 설정 (package.json, tsconfig.json, 의존성)
2. BaseCrawler + RuliwwebCrawler 구현
3. rawStorage (DynamoDB 원본 저장 + 중복 감지)
4. SQS 핸들러 + crawlerFactory 구현
5. CDK CrawlerStack 구현
6. SAM 로컬 테스트 템플릿 및 이벤트 파일

## 5. 완료 기준

- TypeScript 타입 오류 0개
- CDK synth 오류 없음
- SAM 로컬 실행 준비 완료 (실제 실행은 Stage 6 통합 테스트에서 일괄 진행)
- CloudWatch Logs 에러 없는 정상 응답 구조 확인

## 6. 작업지시자 승인 요청

위 수행 계획으로 Task #3 루리웹 크롤러 구현을 시작해도 될까요?
