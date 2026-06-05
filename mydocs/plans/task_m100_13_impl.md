# 구현 계획서 — Task M100 #13
## PopgaCrawler 서브컬처 분류(category 추출) 버그 수정

> 작성일: 2026-06-05
> 이슈: [#13](https://github.com/Chocobone/subculture_map_KR/issues/13)
> 마일스톤: M100 (v1.0.0)
> 브랜치: `local/task13`
> 수행 계획서: `mydocs/plans/task_m100_13.md`

---

## 코드 조사 결과 (실제 탐색 기반)

### 현재 동작 (`backend/crawler/src/crawlers/PopgaCrawler.ts`)

| 메서드 | 라인 | 현황 |
|--------|------|------|
| `parseDetail` | 144 | `parseNextData(html) ?? parseHtml(html)` — 라이브엔 `__NEXT_DATA__` 없음 → 항상 `parseHtml` |
| `parseHtml` | 181 | category를 `[class*="category"], [class*="tag"], [class*="badge"]` 에서 추출 → **항상 `''`** |
| `isSubculture` | 204 | `SUBCULTURE_CATEGORY_KEYWORDS = ['애니','캐릭터','게임']` 포함 검사 → `''` 입력이라 항상 false |

### 실측 데이터 (라이브 popup 상세)
- `<meta name="keywords">` 예: `홍대,귀멸의칼날,animate 홍대점,홍대 팝업,애니메이션,굿즈,캐릭터`
- `parseHtml`의 title(h1/h2)·날짜(정규식)·place·summary(meta description) 추출은 **이미 정상**. **category만 실패**.

### 설계 결정 (테스트 호환 우선)
- `isSubculture(category: string)` **시그니처를 유지**한다 → 기존 `it.each` 테스트(`isSubculture('애니/캐릭터')` 등)가 그대로 통과.
- 대신 `parseHtml`이 **`category`에 meta keywords 문자열을 채우도록** 보강한다. `isSubculture`는 부분 문자열 포함 검사이므로, keywords에 `캐릭터/애니메이션/게임` 이 있으면 정상 검출된다.
- `SUBCULTURE_CATEGORY_KEYWORDS`에 `웹툰`을 추가한다(`애니메이션`은 `애니` 부분일치로 이미 커버).
- 기존 class 선택자·`og:title`은 **보조 폴백**으로 남겨 향후 DOM 변경에 대비한다.

> 영향 범위: `backend/crawler` 한정. 인프라/프론트/API/다른 크롤러 무변경.

---

## 구현 단계

### Stage 1 — 실 구조 HTML fixture + 회귀 테스트 (red)
**파일**: `backend/crawler/src/__tests__/PopgaCrawler.test.ts` (+ 인라인 fixture)

`__NEXT_DATA__`가 **없고** `<meta name="keywords">`를 가진 실제 구조의 HTML fixture를 추가하고, 현재 버그를 재현하는 테스트를 작성한다(이 시점엔 실패=red).

```typescript
// __NEXT_DATA__ 없이 meta keywords만 있는 실 구조
const SAMPLE_HTML_META = (opts: { title: string; keywords: string; dates: string; desc?: string }) => `
<!DOCTYPE html><html><head>
  <meta property="og:title" content="${opts.title} | 팝가">
  <meta name="keywords" content="${opts.keywords}">
  <meta name="description" content="${opts.desc ?? ''}">
</head><body>
  <h1>${opts.title}</h1>
  <p>${opts.dates}</p>
</body></html>`;

describe('parseDetail via meta (no __NEXT_DATA__)', () => {
  it('서브컬처: meta keywords의 캐릭터/애니메이션을 category로 추출한다', () => {
    const html = SAMPLE_HTML_META({
      title: '귀멸의 칼날 스프링 페어',
      keywords: '홍대,귀멸의칼날,animate 홍대점,홍대 팝업,애니메이션,굿즈,캐릭터',
      dates: '26. 04. 25 - 26. 09. 06',
    });
    const d = crawler.parseDetail(html);
    expect(d).not.toBeNull();
    expect(d!.title).toBe('귀멸의 칼날 스프링 페어');
    expect(crawler.isSubculture(d!.category)).toBe(true);   // ← 현재 false (red)
  });

  it('비서브컬처: 뷰티 keywords는 isSubculture=false', () => {
    const html = SAMPLE_HTML_META({
      title: '클리시어 팝업',
      keywords: '여의도,클리시어,더현대 서울,뷰티,잼스토어',
      dates: '26. 06. 11 - 26. 06. 17',
    });
    const d = crawler.parseDetail(html);
    expect(crawler.isSubculture(d!.category)).toBe(false);
  });
});
```

**검증**: `npm test` 실행 시 서브컬처 케이스가 실패(현 버그 재현)하는지 확인.

---

### Stage 2 — `parseHtml` category 추출 보강 (meta keywords)
**파일**: `backend/crawler/src/crawlers/PopgaCrawler.ts`

`parseHtml`에서 category 추출 우선순위를 **meta keywords → 기존 class 선택자 → og:title** 폴백 체인으로 변경한다.

```typescript
// 변경 전 (line 191~192)
// 카테고리: 배지/태그 요소에서 추출
const category = $('[class*="category"], [class*="tag"], [class*="badge"]').first().text().trim();

// 변경 후
const metaKeywords = $('meta[name="keywords"]').attr('content')?.trim() ?? '';
const classCategory = $('[class*="category"], [class*="tag"], [class*="badge"]').first().text().trim();
const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() ?? '';
// isSubculture가 부분문자열 포함 검사이므로 keywords 전체를 category로 사용
const category = metaKeywords || classCategory || ogTitle;
```

**검증**: Stage 1의 서브컬처 케이스가 통과(green)로 전환되는지 확인. 비서브컬처 케이스는 계속 false 유지.

---

### Stage 3 — `isSubculture` 키워드 집합 확장 (웹툰)
**파일**: `backend/crawler/src/crawlers/PopgaCrawler.ts`

```typescript
// 변경 전 (line 13)
const SUBCULTURE_CATEGORY_KEYWORDS = ['애니', '캐릭터', '게임'];

// 변경 후 (웹툰 추가; 애니메이션은 '애니' 부분일치로 커버)
const SUBCULTURE_CATEGORY_KEYWORDS = ['애니', '캐릭터', '게임', '웹툰'];
```

웹툰 양성 케이스 테스트 1건 추가:
```typescript
it('웹툰 키워드도 서브컬처로 판정한다', () => {
  expect(crawler.isSubculture('홍대,디어데인,네이버웹툰,웹툰 팝업')).toBe(true);
});
```

**검증**: 기존 `isSubculture` it.each(뷰티/패션/라이프스타일=false) 유지 확인.

---

### Stage 4 — 전체 테스트 green + 라이브 표본 수동 검증
**파일**: 없음(검증 단계)

1. `cd backend/crawler && npm test` — 전체 통과(신규 + 기존).
2. 라이브 수동 검증: 최근 표본 수집 시 서브컬처 팝업이 정상 검출(0건 → 다수)됨을 확인하고 결과 수치를 최종 보고서에 기록.
   - (로컬 브리지 또는 일회성 스크립트로 표본 수집 — 추적 소스 무수정)

---

## 단계별 커밋 계획

| Stage | 커밋 메시지 | 수정 파일 |
|-------|------------|-----------|
| 1 | `Task #13 Stage1: 실 구조 meta keywords 회귀 테스트 추가 (버그 재현)` | `PopgaCrawler.test.ts` + `working/task_m100_13_stage1.md` |
| 2 | `Task #13 Stage2: parseHtml category를 meta keywords 기반으로 추출` | `PopgaCrawler.ts` + `working/task_m100_13_stage2.md` |
| 3 | `Task #13 Stage3: isSubculture 키워드에 웹툰 추가` | `PopgaCrawler.ts`, `PopgaCrawler.test.ts` + `working/task_m100_13_stage3.md` |
| 4 | `Task #13 Stage4: 전체 테스트 통과 + 라이브 표본 검증` | `working/task_m100_13_stage4.md` |

> 각 단계의 단계별 완료 보고서(`working/task_m100_13_stage{N}.md`)는 해당 소스 커밋과 함께 `local/task13`에서 커밋한다.

---

## 위험 및 대응

| 위험 | 가능성 | 대응 |
|------|--------|------|
| keywords에 우연히 '게임/캐릭터' 포함된 비서브컬처 과탐 | 낮음 | 비서브컬처(뷰티/패션) 음성 테스트로 가드 |
| 일부 페이지 meta keywords 누락 | 낮음 | class 선택자·og:title 폴백 유지 |
| 향후 popga DOM 재변경 | 낮음 | 다중 폴백 체인으로 견고성 확보 |

---

## 완료 기준
- 신규 회귀 테스트(양성/음성/웹툰) + 기존 전체 테스트 통과.
- 라이브 표본에서 서브컬처 팝업 정상 검출(0건 → 다수) 확인.

---

*작업지시자 승인 요청 — 승인 후 Stage 1부터 구현 시작*
