# 최종 결과 보고서 — Task M100 #13
## PopgaCrawler 서브컬처 분류(category 추출) 버그 수정

> 작성일: 2026-06-05
> 이슈: [#13](https://github.com/Chocobone/subculture_map_KR/issues/13)
> 마일스톤: M100 (v1.0.0)
> 브랜치: `local/task13`
> 관련 문서: 수행 계획서 `plans/task_m100_13.md` · 구현 계획서 `plans/task_m100_13_impl.md`

---

## 1. 개요

라이브 popga.co.kr에서 `PopgaCrawler`의 서브컬처 분류가 **0건**으로 동작하던 버그를 수정했다.
크롤러의 상세 파싱(title/날짜/장소/요약)은 정상이었으나 **category만 추출하지 못해** 모든 팝업이
`isSubculture()`에서 탈락하던 문제였다.

---

## 2. 원인

| 단계 | 문제 |
|------|------|
| `parseDetail` | 라이브 페이지에 `__NEXT_DATA__`가 없어 항상 `parseHtml` 폴백 |
| `parseHtml` | category를 `[class*="category"\|"tag"\|"badge"]`에서 추출 → 현재 DOM과 불일치 → `category=''` |
| `isSubculture('')` | 빈 문자열이라 항상 false → 서브컬처 0건 |

- 실제 category 신호는 `<meta name="keywords">`에 존재 (예: `...,애니메이션,굿즈,캐릭터`).
- 기존 단위 테스트는 `__NEXT_DATA__` fixture만 커버하여 라이브 폴백 경로의 버그를 잡지 못함.

---

## 3. 수정 내용

| 파일 | 변경 |
|------|------|
| `backend/crawler/src/crawlers/PopgaCrawler.ts` | `parseHtml` category 추출을 **meta keywords → class 선택자 → og:title** 폴백 체인으로 보강 |
| `backend/crawler/src/crawlers/PopgaCrawler.ts` | `SUBCULTURE_CATEGORY_KEYWORDS`에 `웹툰` 추가 (`애니메이션`은 `애니` 부분일치로 커버) |
| `backend/crawler/src/__tests__/PopgaCrawler.test.ts` | 실 구조(`__NEXT_DATA__` 없음 + meta keywords) fixture·회귀 테스트, 웹툰 양성 케이스 추가 |

### 설계 결정
- `isSubculture(category: string)` **시그니처를 유지**하여 기존 테스트 호환성 확보.
- `parseHtml`이 category에 keywords 문자열을 채우고, `isSubculture`의 부분문자열 검사로 검출.
- class 선택자·og:title은 보조 폴백으로 유지(향후 DOM 변경 대비).

---

## 4. 단계별 진행 및 커밋

| Stage | 내용 | 커밋 |
|-------|------|------|
| 계획 | 수행·구현 계획서 + 오늘할일 | `5df23d2` |
| 1 | 실 구조 회귀 테스트 (버그 재현, red) | `83336cd` |
| 2 | parseHtml category(meta keywords) 보강 (green) | `521cdda` |
| 3 | isSubculture 웹툰 키워드 추가 | `2d6b82d` |
| 4 | 전체 테스트 + 라이브 표본 검증 | `ec9f650` |

---

## 5. 검증 결과

### 단위 테스트
```
cd backend/crawler && npm test
Tests: 18 passed, 18 total
```

### 라이브 표본 (수정된 크롤러 자체 경로)
| 구분 | 수정 전 | 수정 후 |
|------|---------|---------|
| 서브컬처 검출 | **0 / 120건** | **22 / 120건** |

- 검출 예시: 헬로키티 팝업 / 오끼뜨 X 산리오캐릭터즈 / 카카오프렌즈 후렌즈문방구 / 블랙핑크 X 다마고치 / 키크니 특별전 / 무유무유 / 도브 & 미피 등 — 과탐 없음.

---

## 6. 영향 범위
- `backend/crawler`에 한정. 인프라/프론트/API/타 크롤러 무변경.
- 수집 파이프라인(handler → eventStorage)은 동일하며, 서브컬처 팝업이 정상 저장되도록 분류가 복구됨.

---

## 7. 잔여/후속

| 항목 | 비고 |
|------|------|
| 지도 좌표(placeLat/placeLng) null로 핀 미표시 | **별도 이슈 [#14](https://github.com/Chocobone/subculture_map_KR/issues/14)** — 지오코딩 견고성·NCP 엔드포인트 점검 |
| 향후 popga DOM 재변경 | 다중 폴백 체인으로 견고성 확보, 변경 시 fixture 갱신 |

---

## 8. 다음 절차
- `local/devel ← local/task13` merge → `devel` push → `main` PR → 리뷰 → merge.
- merge 후 이슈 #13 클로즈(작업지시자 승인 후).

---

*작업지시자 승인 요청 — 승인 후 merge 절차 진행*
