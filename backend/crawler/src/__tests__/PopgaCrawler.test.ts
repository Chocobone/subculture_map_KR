import axios from 'axios';
import { PopgaCrawler } from '../crawlers/PopgaCrawler';

jest.mock('axios');
const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

const SAMPLE_SITEMAP = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url>
    <loc>https://popga.co.kr/popup/100</loc>
    <lastmod>${recentDate(5)}</lastmod>
  </url>
  <url>
    <loc>https://popga.co.kr/popup/200</loc>
    <lastmod>${recentDate(10)}</lastmod>
  </url>
  <url>
    <loc>https://popga.co.kr/popup/999</loc>
    <lastmod>${recentDate(60)}</lastmod>
  </url>
  <url>
    <loc>https://popga.co.kr/list/popup</loc>
    <lastmod>${recentDate(1)}</lastmod>
  </url>
</urlset>
`;

const SAMPLE_NEXT_DATA_HTML = (popup: object) => `
<!DOCTYPE html><html><body>
<script id="__NEXT_DATA__" type="application/json">
${JSON.stringify({ props: { pageProps: { popup } } })}
</script>
</body></html>
`;

function recentDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

describe('PopgaCrawler', () => {
  let crawler: PopgaCrawler;

  beforeEach(() => {
    crawler = new PopgaCrawler();
    jest.clearAllMocks();
  });

  // ── 1. 사이트맵 파싱 ────────────────────────────────────────────────────────

  describe('parseSitemap', () => {
    it('30일 이내 수정된 /popup/{id} URL만 반환한다', () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const entries = crawler.parseSitemap(SAMPLE_SITEMAP, cutoff);

      const urls = entries.map(e => e.url);
      expect(urls).toContain('https://popga.co.kr/popup/100');
      expect(urls).toContain('https://popga.co.kr/popup/200');
      // 60일 전 항목 제외
      expect(urls).not.toContain('https://popga.co.kr/popup/999');
      // /popup/{id} 형식 아닌 URL 제외
      expect(urls).not.toContain('https://popga.co.kr/list/popup');
    });
  });

  // ── 2. 상세 페이지 파싱 — __NEXT_DATA__ ────────────────────────────────────

  describe('parseDetail via __NEXT_DATA__', () => {
    it('__NEXT_DATA__ popup 필드에서 이벤트 정보를 파싱한다', () => {
      const html = SAMPLE_NEXT_DATA_HTML({
        name:        '원피스 팝업스토어',
        startAt:     '2025-07-01T00:00:00Z',
        endAt:       '2025-07-31T00:00:00Z',
        location:    { name: '스타필드 코엑스' },
        categories:  ['애니/캐릭터'],
        description: '원피스 25주년 기념 팝업',
      });

      const detail = crawler.parseDetail(html);

      expect(detail).not.toBeNull();
      expect(detail!.title).toBe('원피스 팝업스토어');
      expect(detail!.startDate).toBe('2025-07-01');
      expect(detail!.endDate).toBe('2025-07-31');
      expect(detail!.place).toBe('스타필드 코엑스');
      expect(detail!.category).toBe('애니/캐릭터');
    });

    it('title이 없으면 null을 반환한다', () => {
      const html = SAMPLE_NEXT_DATA_HTML({ startAt: '2025-01-01' });
      expect(crawler.parseDetail(html)).toBeNull();
    });
  });

  // ── 3. 카테고리 필터 ────────────────────────────────────────────────────────

  describe('isSubculture', () => {
    it.each([
      ['애니/캐릭터', true],
      ['캐릭터', true],
      ['게임', true],
      ['뷰티', false],
      ['패션', false],
      ['라이프스타일', false],
    ])('카테고리 "%s" → isSubculture=%s', (category, expected) => {
      expect(crawler.isSubculture(category)).toBe(expected);
    });
  });

  // ── 4. 키워드 매칭 ──────────────────────────────────────────────────────────

  describe('matchesKeywords', () => {
    const base = { title: '원피스 팝업', startDate: '', endDate: '', place: '', category: '', summary: '루피 한정 굿즈' };

    it('keywords가 title에 포함되면 true를 반환한다', () => {
      expect(crawler.matchesKeywords(base, ['원피스', 'One Piece'])).toBe(true);
    });

    it('keywords가 summary에 포함되면 true를 반환한다', () => {
      expect(crawler.matchesKeywords(base, ['루피'])).toBe(true);
    });

    it('keywords가 모두 불일치하면 false를 반환한다', () => {
      expect(crawler.matchesKeywords(base, ['나루토', '진격의 거인'])).toBe(false);
    });

    it('keywords 배열이 비어있으면 항상 true를 반환한다', () => {
      expect(crawler.matchesKeywords(base, [])).toBe(true);
    });
  });

  // ── 5. fetch 통합 흐름 ──────────────────────────────────────────────────────

  describe('fetch', () => {
    it('서브컬처 카테고리 + 키워드 매칭된 팝업만 RawItem으로 반환한다', async () => {
      // 사이트맵 5개 fetch mock
      mockedGet.mockImplementation((url: string) => {
        if (String(url).includes('/sitemap/')) {
          return Promise.resolve({ data: SAMPLE_SITEMAP });
        }
        if (String(url).includes('/popup/100')) {
          return Promise.resolve({
            data: SAMPLE_NEXT_DATA_HTML({
              name:        '원피스 팝업스토어',
              startAt:     '2025-07-01',
              endAt:       '2025-07-31',
              location:    { name: '코엑스' },
              categories:  ['애니/캐릭터'],
              description: '25주년 기념',
            }),
          });
        }
        if (String(url).includes('/popup/200')) {
          return Promise.resolve({
            data: SAMPLE_NEXT_DATA_HTML({
              name:       '나이키 팝업',
              startAt:    '2025-07-01',
              endAt:      '2025-07-31',
              location:   { name: '홍대' },
              categories: ['패션'],
              description: '나이키 신발',
            }),
          });
        }
        return Promise.resolve({ data: '' });
      });

      const items = await crawler.fetch(['원피스']);

      expect(items).toHaveLength(1);
      expect(items[0].url).toBe('https://popga.co.kr/popup/100');
      expect(items[0].source).toBe('popga');

      const parsed = JSON.parse(items[0].text);
      expect(parsed.title).toBe('원피스 팝업스토어');
      expect(parsed.type).toBe('popup');
    });
  });
});
