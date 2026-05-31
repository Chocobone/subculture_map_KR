# CLAUDE.md

Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참조하는 가이드입니다.

## 프로젝트 개요

**목표**: 서브컬쳐(애니·게임 등) 팝업스토어·한정 행사를 자동 수집·정리하는 풀스택 웹 애플리케이션

```
커뮤니티(트위터/루리웹/네이버카페) → Crawler → Bedrock(분류) → Aurora → API → React SPA
```

- **프론트엔드**: React SPA — 관심 IP 등록, 행사 피드, 필터, 캘린더
- **API**: Lambda + API Gateway — 행사 CRUD, IP 관리, 크롤링 트리거
- **크롤러**: Lambda + SQS — 소스별 자동 수집, Bedrock AI 분류
- **알림**: SNS 팬아웃 → SES(이메일) + WebSocket(앱 내 실시간)
- **인프라**: AWS CDK v2(TypeScript)로 전체 리소스 코드화

---

## 클로드 코드 사용 시 주의사항

이 프로젝트는 **하이퍼-워터폴(Hyper-Waterfall)** 방법론을 적용한다.
Claude Code의 기본 동작(빠른 실행, 자율 수정)과 충돌이 발생할 수 있으므로 반드시 숙지한다.

상세 내용: [`mydocs/manual/hyper_waterfall.md`](mydocs/manual/hyper_waterfall.md)

**핵심 규칙 요약**:
- 소스 수정 전 반드시 작업지시자 승인 요청
- 이슈 → 브랜치 → 할일 → 계획서 → 구현 순서 절대 생략 금지
- 각 단계 완료 후 승인 없이 다음 단계 진행 금지
- 이슈 클로즈는 작업지시자 승인 후에만 수행
- 작업 시간의 시작과 종료는 작업지시자가 결정한다. Claude가 임의로 작업 종료를 제안하거나 시간을 한정하지 않는다.

---

## 문서 생성 규칙

모든 문서는 한국어로 작성한다.

문서 폴더 구조 (`mydocs/` 하위):

```
mydocs/
├── orders/          ← 오늘 할일 (yyyymmdd.md)
├── plans/           ← 수행 계획서, 구현 계획서
├── plans/archives/  ← 완료된 계획서 보관
├── working/         ← 단계별 완료 보고서
├── report/          ← 최종 결과 보고서
├── feedback/        ← 작업지시자 피드백 저장
├── tech/            ← 기술 사항 정리 문서
├── manual/          ← 매뉴얼, 가이드 문서
├── troubleshootings/ ← 트러블슈팅 기록
├── pr/              ← 외부 기여자 PR 검토 기록
└── pr/archives/     ← 처리 완료된 PR 보관
```

### 문서 파일명 규칙

| 문서 종류 | 파일명 형식 | 예시 |
|-----------|-------------|------|
| 오늘 할일 | `orders/yyyymmdd.md` | `orders/20260601.md` |
| 수행 계획서 | `plans/task_{milestone}_{이슈번호}.md` | `plans/task_m100_12.md` |
| 구현 계획서 | `plans/task_{milestone}_{이슈번호}_impl.md` | `plans/task_m100_12_impl.md` |
| 단계별 완료 보고서 | `working/task_{milestone}_{이슈번호}_stage{N}.md` | `working/task_m100_12_stage1.md` |
| 최종 결과 보고서 | `report/task_{milestone}_{이슈번호}_report.md` | `report/task_m100_12_report.md` |

**접두어·접미어 규칙:**
- `task_` 접두어는 **필수**. `task_bug_`, `task_feat_` 등 성격별 접두어는 사용하지 않는다.
- 마일스톤은 항상 `m{숫자}` 형식(예: `m100`, `m200`). `m` 없이 숫자만 적거나 생략하지 않는다.
- 후속 수정이 필요한 경우 `_v2`, `_v3` 접미어 사용. `_fix`, `_hotfix` 등 모호한 접미어는 쓰지 않는다.

**폴더 역할 (엄격 준수):**

| 폴더 | 용도 | 비고 |
|------|------|------|
| `orders/` | 오늘 할일 | `yyyymmdd.md`만 허용 |
| `plans/` | 수행·구현 계획서 | `_stage{N}`, `_report`는 여기 두지 않는다 |
| `plans/archives/` | 완료된 계획서 보관 | merge 후 정리 시 사용 |
| `working/` | 단계별 완료 보고서 (`_stage{N}.md`) | 최종 보고서는 여기 두지 않는다 |
| `report/` | 최종 결과보고서 (`_report.md`) | **최종 보고서는 반드시 이 폴더** |
| `feedback/` | 작업지시자 피드백, 코드 리뷰 의견 | |
| `tech/` | 기술 조사·분석 | AWS 서비스 스펙, 라이브러리 발견 등 |
| `manual/` | 매뉴얼, 가이드 | 사용자/개발자 문서 |
| `troubleshootings/` | 트러블슈팅 | 재발 방지용 해결 기록 |
| `pr/` | 외부 기여자 PR 검토 기록 | 내부 타스크와 분리 |
| `pr/archives/` | 처리 완료된 PR 보관 | |

### 필수 참조 문서

- `mydocs/manual/hyper_waterfall.md` — Hyper-Waterfall 방법론 전체 설명
- `mydocs/manual/onboarding_guide.md` — 신규 기여자 온보딩 가이드
- `docs/architecture.md` — AWS 전체 아키텍처
- `docs/api-spec.md` — REST + WebSocket API 명세
- `docs/db-schema.md` — Aurora + DynamoDB 스키마

---

## 빌드 및 실행

### 로컬 개발 서버

```bash
# 전체 의존성 설치
npm install -ws

# 프론트엔드 개발 서버 (localhost:5173)
cd frontend && npm run dev

# Lambda 로컬 테스트 (SAM CLI 필요)
cd backend && sam local start-api --env-vars env.json

# 테스트 전체 실행
npm run test -ws
```

### 인프라 배포

```bash
# 최초 1회: CDK 부트스트랩
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-2

# 개발 스택 전체 배포
cd infra && npx cdk deploy --all --context env=dev

# 변경 사항 미리보기
npx cdk diff --all --context env=dev

# 특정 스택만 배포
npx cdk deploy SubcultureTracker-Crawler-dev
```

환경 변수는 각 패키지의 `.env.example`을 복사해 `.env.local`로 사용한다.

---

## 프로젝트 구조

```
subculture-tracker/
├── CLAUDE.md                       ← 이 파일 (Claude Code 루트 가이드)
├── frontend/                       ← React + TypeScript SPA
│   ├── CLAUDE.md                   ← 프론트엔드 작업 가이드
│   └── src/
├── backend/
│   ├── api/                        ← Lambda API 핸들러
│   │   └── CLAUDE.md
│   ├── crawler/                    ← 크롤러 워커 Lambda
│   │   └── CLAUDE.md
│   └── notifier/                   ← 알림 발송 Lambda
│       └── CLAUDE.md
├── infra/                          ← AWS CDK v2 인프라
│   └── CLAUDE.md
├── shared/types/                   ← 공용 TypeScript 타입
├── docs/                           ← 아키텍처·API·스키마 문서
└── mydocs/                         ← Hyper-Waterfall 작업 문서
    ├── orders/
    ├── plans/
    ├── working/
    ├── report/
    ├── feedback/
    ├── tech/
    ├── manual/
    └── troubleshootings/
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18, TypeScript, Vite, TanStack Query, Tailwind CSS |
| API | AWS Lambda (Node.js 20), API Gateway REST + WebSocket |
| 크롤러 | Lambda, Cheerio, SQS, EventBridge |
| AI 분류 | AWS Bedrock (Claude Haiku) |
| DB | Aurora PostgreSQL Serverless v2, DynamoDB, OpenSearch |
| 캐시 | ElastiCache Redis |
| 인증 | Amazon Cognito |
| 인프라 | AWS CDK v2 (TypeScript) |
| CI/CD | GitHub Actions |

---

## 워크플로우

### 브랜치 관리

| 브랜치 | 용도 |
|--------|------|
| `main` | 릴리즈. 태그(v1.0.0 등)로 안정 버전 보존 |
| `devel` | 개발 통합 |
| `local/devel` | devel의 로컬 작업 브랜치. 완료 후 devel에 merge |
| `local/task{N}` | GitHub Issue 번호 기반 타스크 브랜치 |

### Git 워크플로우

```
local/task{N}  ──커밋──커밋──┐
                              ├─→ local/devel merge
                              ├─→ devel merge + push
                              └─→ main PR → 리뷰 → merge → 태그 (릴리즈)
```

- **타스크 브랜치**: `local/task{N}`에서 잘게 커밋. 작업 단위마다 커밋.
- **원격 push**: `devel`만 push. `local/devel`과 `local/task` 브랜치는 **로컬 유지**.
- **커밋 메시지**: `Task #N: 내용` 형식 (Issue 번호 참조)

```bash
# 타스크 시작
gh issue create --title "제목" --body "설명" --milestone "v1.0.0"
git checkout -b local/task{N} devel

# 완료 후 merge
git checkout local/devel && git merge local/task{N} --no-ff
git checkout devel && git merge local/devel --no-ff && git push origin devel
```

### 타스크 진행 절차

1. GitHub Issue에 타스크 등록 → 작업지시자가 지정
2. `local/task{issue번호}` 브랜치 생성
3. **수행 계획서** 작성 → 승인 요청 (**구현 전 필수**)
4. **구현 계획서** 작성 (최소 3단계, 최대 6단계) → 승인 요청
5. 단계별 구현 시작
6. 각 단계 완료 후 **단계별 완료 보고서** 작성 → 승인 요청
7. 단계별 완료 보고서는 해당 단계 소스 커밋과 **함께 타스크 브랜치에서 커밋**
8. 승인 후 다음 단계 진행
9. 모든 단계 완료 → **최종 결과 보고서** 작성 → 승인 요청
10. 최종 보고서와 오늘할일 갱신도 타스크 브랜치에서 커밋. merge 전 `git status`로 미커밋 파일 없는지 확인

### 마일스톤 표기

- `M{버전}` 형식: `M100`=v1.0.0, `M200`=v2.0.0
- `mydocs/orders/`에서 `M100 #1` 형식으로 마일스톤+이슈 참조

---

## 작업별 진입점

| 목표 | 참고 파일 |
|------|-----------|
| UI 컴포넌트 수정 | `frontend/CLAUDE.md` |
| API 엔드포인트 추가 | `backend/api/CLAUDE.md` |
| 새 크롤링 소스 추가 | `backend/crawler/CLAUDE.md` |
| 알림 채널 추가 | `backend/notifier/CLAUDE.md` |
| AWS 리소스 변경 | `infra/CLAUDE.md` |
| DB 스키마 변경 | `docs/db-schema.md` |
| API 스펙 확인 | `docs/api-spec.md` |
