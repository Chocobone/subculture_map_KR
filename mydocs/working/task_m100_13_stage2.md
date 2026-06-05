# 단계별 완료 보고서 — Task M100 #13 / Stage 2
## parseHtml category를 meta keywords 기반으로 추출

> 작성일: 2026-06-05
> 이슈: [#13](https://github.com/Chocobone/subculture_map_KR/issues/13)
> 브랜치: `local/task13`
> 구현 계획서: `mydocs/plans/task_m100_13_impl.md` (Stage 2)

---

## 1. 목표
`parseHtml`이 `<meta name="keywords">`에서 category를 추출하도록 보강하여 Stage 1 회귀 테스트를 green으로 전환한다.

---

## 2. 변경 내용

### 파일: `backend/crawler/src/crawlers/PopgaCrawler.ts` (`parseHtml`)

category 추출을 단일 class 선택자에서 **다중 폴백 체인**으로 교체.

```typescript
// 변경 전
const category = $('[class*="category"], [class*="tag"], [class*="badge"]').first().text().trim();

// 변경 후
const metaKeywords  = $('meta[name="keywords"]').attr('content')?.trim() ?? '';
const classCategory = $('[class*="category"], [class*="tag"], [class*="badge"]').first().text().trim();
const ogTitle       = $('meta[property="og:title"]').attr('content')?.trim() ?? '';
// isSubculture는 부분 문자열 포함 검사이므로 keywords 전체를 category로 사용
const category = metaKeywords || classCategory || ogTitle;
```

- 우선순위: **meta keywords → class 선택자 → og:title** (향후 DOM 변경 대비 폴백 유지).
- `isSubculture(category)` 시그니처·로직 무변경 → 기존 테스트 호환.

---

## 3. 실행 결과 (green 전환)

```
parseDetail via meta (no __NEXT_DATA__)
  √ 서브컬처: meta keywords의 캐릭터/애니메이션을 category로 추출한다
  √ 비서브컬처: 뷰티 keywords는 isSubculture=false

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

- Stage 1의 red 케이스 → green 전환.
- 기존 15개 테스트 + 비서브컬처 케이스 전부 통과(회귀 없음).

---

## 4. 다음 단계
- **Stage 3**: `SUBCULTURE_CATEGORY_KEYWORDS`에 `웹툰` 추가 + 양성 테스트 1건.

---

*작업지시자 승인 요청 — 승인 후 Stage 3 진행*
