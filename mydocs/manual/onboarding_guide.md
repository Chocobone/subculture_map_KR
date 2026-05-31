# 서브컬쳐 트래커 온보딩 가이드

이 프로젝트는 **Claude Code(AI 에이전트)와 작업지시자(Human)가 협업**하여 개발합니다.
**Hyper-Waterfall** 방법론을 적용하므로, 전통적인 개발 워크플로우와 다른 점이 많습니다.
이 문서를 반드시 숙지하세요.

## 1. 프로젝트 개요

```
커뮤니티 크롤링 소스
(트위터/루리웹/네이버카페/디시/에펨코리아)
        │
        ▼ EventBridge (매 1시간)
      SQS 큐 (IP × 소스 분산)
        │
        ▼ Lambda 크롤러
      Bedrock Claude Haiku (행사 분류·추출)
        │
        ▼
   Aurora PostgreSQL  ←──→  OpenSearch (전문검색)
   DynamoDB (원본)
   S3 (HTML 아카이브)
        │
        ▼ Lambda API
   API Gateway REST + WebSocket
        │
        ▼
   React SPA (CloudFront + S3)
   Cognito (인증)
```

## 2. 개발 환경 설정

### 2.1 필수 도구

```bash
# Node.js 20+
node --version   # v20 이상

# AWS CLI + CDK
npm install -g aws-cdk
aws configure    # 개발용 IAM 키 설정

# SAM CLI (Lambda 로컬 테스트)
brew install aws-sam-cli   # macOS
# 또는 pip install aws-sam-cli
```

### 2.2 로컬 개발 환경

```bash
# 저장소 클론 후
npm install -ws          # 워크스페이스 전체 의존성 설치

# 프론트엔드 개발 서버
cd frontend && npm run dev    # localhost:5173

# Lambda 로컬 실행
cd backend && sam local start-api --env-vars env.json

# 테스트
npm run test -ws
npm run typecheck -ws
npm run lint -ws
```

### 2.3 인프라 배포 (개발 계정)

```bash
cd infra
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-2   # 최초 1회
npx cdk deploy --all --context env=dev
```

## 3. 작업지시자-에이전트 협업 모델

### 3.1 역할

| 역할 | 담당 | 책임 |
|------|------|------|
| **작업지시자** (Human) | 프로젝트 오너 | 타스크 지정, 기능 검증, 승인/반려, 방향 수정 |
| **에이전트** (Claude Code) | AI 개발자 | 코드 분석, Lambda·CDK·React 구현, 문서 작성 |

### 3.2 타스크 진행 절차

```
1. 작업지시자: GitHub Issue 생성, mydocs/orders/에 할일 등록
2. 에이전트:  수행 계획서 작성 → 승인 요청
3. 작업지시자: 승인 또는 수정 지시
4. 에이전트:  구현 계획서 작성 (3~6단계) → 승인 요청
5. 작업지시자: 승인
6. 에이전트:  단계별 구현 → 각 단계 완료 보고서 → 승인 요청
7. 작업지시자: 검증 후 승인 또는 피드백
8. 반복...
9. 에이전트:  최종 결과 보고서 → 커밋 → devel merge 요청
10. 작업지시자: 최종 승인 → merge → 이슈 클로즈
```

### 3.3 핵심 원칙

- **승인 기반 진행**: 단계별 승인 없이 다음 단계로 넘어가지 않음
- **즉각적 방향 수정**: "원복하세요", "다른 방식으로 접근하세요" → 즉시 원복 후 재분석
- **작업 종료는 작업지시자가 결정**: 에이전트가 임의로 "오늘은 여기까지 합시다"라고 말하지 않음

## 4. 오늘할일 문서 형식

`mydocs/orders/yyyymmdd.md` 형식 예시:

```markdown
# 20260601 오늘 할일

## M100 — 크롤러 기반 구축

| Issue | 타스크 | 상태 |
|-------|--------|------|
| [#3](https://github.com/your/repo/issues/3) | 루리웹 크롤러 구현 | 진행중 |
| [#4](https://github.com/your/repo/issues/4) | SQS DLQ 설정 | 대기 |

## 백로그

- B-001: OpenSearch 한국어 형태소 분석기 nori 설정 최적화
- B-002: ElastiCache 캐시 무효화 전략 개선
```

## 5. 검증 체계

### 5.1 에이전트가 수행하는 검증

```bash
# TypeScript 타입 검사
npm run typecheck -ws

# ESLint
npm run lint -ws

# 테스트
npm run test -ws

# CDK 변경 확인 (의도치 않은 리소스 변경 방지)
cd infra && npx cdk diff --all --context env=dev
```

### 5.2 작업지시자가 수행하는 검증

| 검증 항목 | 방법 |
|-----------|------|
| API 동작 확인 | dev 스택 배포 후 실제 엔드포인트 호출 |
| 크롤러 수집 결과 | AWS Console → DynamoDB에 원본 데이터 확인 |
| 행사 분류 정확도 | 수집된 행사의 type(팝업/콜라보/굿즈/한정) 검토 |
| 알림 발송 확인 | 테스트 이메일 수신 + WebSocket 메시지 수신 |
| 프론트엔드 렌더링 | 브라우저에서 직접 확인 |

### 5.3 피드백 유형

| 유형 | 예시 | 에이전트 대응 |
|------|------|-------------|
| **즉시 원복** | "이 Lambda 함수 원복하세요" | git checkout으로 즉시 원복 |
| **방향 전환** | "SQS 대신 EventBridge Pipe로 가세요" | 현재 접근 폐기, 새 분석 시작 |
| **정보 제공** | "루리웹은 로그인 없이 접근 가능합니다" | 크롤러 로직에 반영 |
| **버그 보고** | "블루아카이브 검색 시 결과가 0건입니다" | CloudWatch 로그로 진단 |
| **백로그 등록** | "근본적 해결은 나중에" | B-XXX로 등록, 현재 범위 한정 |

## 6. 코드 구조 이해

### 6.1 핵심 모듈 의존 관계

```
shared/types (공용 타입, 외부 의존 없음)
    ↑
backend/api        ← Aurora, ElastiCache, API Gateway
backend/crawler    ← SQS, DynamoDB, S3, Bedrock
backend/notifier   ← SNS, SES, API Gateway WebSocket
    ↑
infra/             ← CDK로 모든 AWS 리소스 선언
frontend/          ← React SPA (shared/types 참조)
```

**`shared/types`는 아무 AWS SDK도 import하지 않는다** (순수 타입 정의).

### 6.2 Lambda 핸들러 공통 패턴

모든 핸들러는 동일한 구조를 따른다:

```typescript
import { Logger } from '@aws-lambda-powertools/logger';
// PowerTools 필수 — 모든 Lambda에 적용

const logger = new Logger({ serviceName: 'handler-name' });

export const handler = async (event) => {
  // 1. 입력 파싱
  // 2. 캐시 확인 (API 핸들러만)
  // 3. 비즈니스 로직
  // 4. 결과 반환
};
```

### 6.3 새 크롤링 소스 추가 절차

1. `backend/crawler/src/crawlers/NewSourceCrawler.ts` 생성 (`BaseCrawler` 상속)
2. `backend/crawler/src/crawlers/crawlerFactory.ts`에 소스 키 등록
3. `backend/crawler/src/utils/rateLimit.ts`에 요청 속도 제한 추가
4. `infra/lib/stacks/crawler-stack.ts`에 SQS 메시지 소스 목록 업데이트
5. `docs/api-spec.md`의 `CrawlSource` 타입 업데이트

## 7. 기여 시 주의사항

1. **shared/types 순수성 유지**: AWS SDK를 import하지 않는다
2. **Lambda 메모리/타임아웃 명시**: CDK 코드에 반드시 지정
3. **Secrets Manager 사용**: API 키, DB 패스워드를 코드에 하드코딩하지 않는다
4. **한국어 문서**: `mydocs/` 아래 모든 문서는 한국어로 작성
5. **PowerTools 필수**: 모든 Lambda에 Logger, Tracer 적용
6. **CDK diff 확인**: 배포 전 `cdk diff`로 의도치 않은 변경 없는지 확인
