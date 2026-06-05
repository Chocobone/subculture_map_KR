# 단계별 완료 보고서 — Task M100 #13 / Stage 1
## 실 구조 meta keywords 회귀 테스트 추가 (버그 재현)

> 작성일: 2026-06-05
> 이슈: [#13](https://github.com/Chocobone/subculture_map_KR/issues/13)
> 브랜치: `local/task13`
> 구현 계획서: `mydocs/plans/task_m100_13_impl.md` (Stage 1)

---

## 1. 목표
라이브 popga.co.kr의 실제 구조(`__NEXT_DATA__` 없음 + `<meta name="keywords">`)를 모사한 HTML fixture로
**현재 버그(서브컬처 분류 0건)를 재현하는 회귀 테스트**를 추가한다. 이 시점에는 의도적으로 실패(red)한다.

---

## 2. 변경 내용

### 파일: `backend/crawler/src/__tests__/PopgaCrawler.test.ts`

- `SAMPLE_HTML_META` fixture 추가 — `__NEXT_DATA__` 없이 `og:title` / `meta[keywords]` / `meta[description]` / `h1` / 날짜 텍스트만 가진 실 구조.
- `describe('parseDetail via meta (no __NEXT_DATA__)')` 블록 추가:
  - **서브컬처 케이스**(귀멸의 칼날, keywords에 `애니메이션,캐릭터`) → `isSubculture(category)` 가 `true`여야 함.
  - **비서브컬처 케이스**(클리시어, keywords에 `뷰티`) → `false`여야 함.

---

## 3. 실행 결과 (red 확인)

```
parseDetail via meta (no __NEXT_DATA__)
  × 서브컬처: meta keywords의 캐릭터/애니메이션을 category로 추출한다
  √ 비서브컬처: 뷰티 keywords는 isSubculture=false

● 서브컬처: ...
  expect(received).toBe(expected)
  Expected: true
  Received: false      ← category='' (parseHtml이 keywords 미추출) → 버그 재현
  at PopgaCrawler.test.ts:123  expect(crawler.isSubculture(d!.category)).toBe(true)

Tests: 1 failed, 15 passed, 16 total
```

- title/not-null 단언은 통과 → `parseHtml`의 title 추출 자체는 정상.
- 실패 지점은 `category` 추출(빈 문자열) → **원인 확정**.
- 기존 15개 테스트 전부 통과(회귀 없음).

---

## 4. 다음 단계
- **Stage 2**: `parseHtml`이 `<meta name="keywords">`에서 category를 추출하도록 보강 → 본 테스트 green 전환.

---

*작업지시자 승인 요청 — 승인 후 Stage 2 진행*
