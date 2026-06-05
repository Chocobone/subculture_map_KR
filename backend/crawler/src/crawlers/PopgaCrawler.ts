import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger } from '@aws-lambda-powertools/logger';
import { BaseCrawler, RawItem } from './BaseCrawler';

const BASE_URL       = 'https://popga.co.kr';
const SITEMAP_COUNT  = 5;
const LASTMOD_DAYS   = 30;
const REQUEST_DELAY  = 300; // ms — 서버 부하 방지
const UA = 'Mozilla/5.0 (compatible; SubcultureBot/1.0)';

// popga.co.kr 카테고리 중 서브컬처 관련 키워드
const SUBCULTURE_CATEGORY_KEYWORDS = ['애니', '캐릭터', '게임'];

// ClassifiedEvent와 동일 구조 (순환 참조 방지를 위해 인라인 정의)
interface StructuredEvent {
  title:     string;
  type:      'popup' | 'collab' | 'goods' | 'limited';
  place:     string;
  startDate: string;
  endDate:   string;
  summary:   string;
}

interface SitemapEntry {
  url:     string;
  lastmod: string;
}

interface PopupDetail {
  title:     string;
  startDate: string;
  endDate:   string;
  place:     string;
  category:  string;
  summary:   string;
}

export class PopgaCrawler extends BaseCrawler {
  readonly source = 'popga' as const;
  private logger  = new Logger({ serviceName: 'PopgaCrawler' });

  async fetch(keywords: string[]): Promise<RawItem[]> {
    const entries  = await this.fetchRecentEntries();
    const results: RawItem[] = [];
    const now      = new Date().toISOString();

    for (const entry of entries) {
      await sleep(REQUEST_DELAY);

      const detail = await this.fetchDetail(entry.url);
      if (!detail) continue;

      if (!this.isSubculture(detail.category)) continue;
      if (!this.matchesKeywords(detail, keywords)) continue;

      const event: StructuredEvent = {
        title:     detail.title,
        type:      'popup',
        place:     detail.place,
        startDate: detail.startDate,
        endDate:   detail.endDate,
        summary:   detail.summary,
      };

      results.push({
        url:       entry.url,
        text:      JSON.stringify(event),
        source:    this.source,
        crawledAt: now,
      });
    }

    return results;
  }

  // ── 사이트맵 수집 ──────────────────────────────────────────────────────────

  async fetchRecentEntries(): Promise<SitemapEntry[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - LASTMOD_DAYS);

    const seen = new Set<string>();
    const all:  SitemapEntry[] = [];

    for (let n = 1; n <= SITEMAP_COUNT; n++) {
      const url = `${BASE_URL}/sitemap/${n}.xml`;
      const xml  = await axios
        .get<string>(url, { headers: { 'User-Agent': UA }, timeout: 10_000 })
        .then(r => r.data)
        .catch(e => {
          this.logger.warn('사이트맵 요청 실패', { url, error: (e as Error).message });
          return '';
        });

      if (!xml) continue;
      for (const entry of this.parseSitemap(xml, cutoff)) {
        if (!seen.has(entry.url)) {
          seen.add(entry.url);
          all.push(entry);
        }
      }
    }

    return all;
  }

  parseSitemap(xml: string, cutoff: Date): SitemapEntry[] {
    const entries: SitemapEntry[] = [];
    // <url>...<loc>https://popga.co.kr/popup/123</loc>...<lastmod>2025-01-01</lastmod>...</url>
    const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];

    for (const block of blocks) {
      const locMatch     = block.match(/<loc>(https:\/\/popga\.co\.kr\/popup\/\d+)<\/loc>/);
      const lastmodMatch = block.match(/<lastmod>(\d{4}-\d{2}-\d{2})/);

      if (!locMatch || !lastmodMatch) continue;

      const lastmod = new Date(lastmodMatch[1]);
      if (lastmod < cutoff) continue;

      entries.push({ url: locMatch[1], lastmod: lastmodMatch[1] });
    }

    return entries;
  }

  // ── 상세 페이지 파싱 ───────────────────────────────────────────────────────

  async fetchDetail(url: string): Promise<PopupDetail | null> {
    const html = await axios
      .get<string>(url, { headers: { 'User-Agent': UA }, timeout: 10_000 })
      .then(r => r.data)
      .catch(e => {
        this.logger.warn('상세 페이지 요청 실패', { url, error: (e as Error).message });
        return null;
      });

    if (!html) return null;

    return this.parseDetail(html);
  }

  parseDetail(html: string): PopupDetail | null {
    // 1차: __NEXT_DATA__ JSON 파싱 (SSR 데이터)
    const detail = this.parseNextData(html) ?? this.parseHtml(html);
    if (!detail?.title) return null;
    return detail;
  }

  private parseNextData(html: string): PopupDetail | null {
    const $ = cheerio.load(html);
    const raw = $('#__NEXT_DATA__').text();
    if (!raw) return null;

    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      const pp   = (data?.props as Record<string, unknown>)?.pageProps as Record<string, unknown> | undefined;
      if (!pp) return null;

      // popga.co.kr pageProps 필드명 탐색 (여러 가능성 시도)
      const popup = (
        (pp.popupDetail ?? pp.popup ?? pp.data ?? pp.popupData) as Record<string, unknown> | undefined
      );
      if (!popup) return null;

      const title    = str(popup.name ?? popup.title ?? popup.popupName);
      const place    = str((popup.location as Record<string, unknown> | undefined)?.name ?? popup.place ?? popup.placeName);
      const category = str((popup.categories as string[] | undefined)?.[0] ?? popup.category);
      const summary  = str(popup.description ?? popup.summary ?? popup.content);
      const startDate = toYmd(str(popup.startAt ?? popup.startDate ?? popup.openDate));
      const endDate   = toYmd(str(popup.endAt   ?? popup.endDate   ?? popup.closeDate));

      if (!title) return null;
      return { title, startDate, endDate, place, category, summary };
    } catch {
      return null;
    }
  }

  private parseHtml(html: string): PopupDetail | null {
    const $ = cheerio.load(html);

    const title = $('h1, h2').first().text().trim();
    if (!title) return null;

    // 날짜 패턴: "24. 07. 19 - 24. 08. 11" 또는 "2024년 7월 19일"
    const bodyText = $('body').text();
    const [startDate, endDate] = extractDates(bodyText);

    // 카테고리: 라이브 popga.co.kr은 category가 meta[keywords]에 위치한다.
    // 우선순위: meta keywords → 배지/태그 클래스 요소 → og:title (DOM 변경 대비 다중 폴백)
    const metaKeywords = $('meta[name="keywords"]').attr('content')?.trim() ?? '';
    const classCategory = $('[class*="category"], [class*="tag"], [class*="badge"]').first().text().trim();
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() ?? '';
    // isSubculture는 부분 문자열 포함 검사이므로 keywords 전체를 category로 사용한다.
    const category = metaKeywords || classCategory || ogTitle;

    // 장소: "장소" 레이블 근처 텍스트
    const place = extractNear($, ['장소', '위치', '주소'], 2);

    const summary = $('meta[name="description"]').attr('content') ?? '';

    return { title, startDate, endDate, place, category, summary };
  }

  // ── 필터 헬퍼 ──────────────────────────────────────────────────────────────

  isSubculture(category: string): boolean {
    const lower = category.toLowerCase();
    return SUBCULTURE_CATEGORY_KEYWORDS.some(kw => lower.includes(kw));
  }

  matchesKeywords(detail: PopupDetail, keywords: string[]): boolean {
    if (keywords.length === 0) return true;
    const haystack = `${detail.title} ${detail.summary}`.toLowerCase();
    return keywords.some(kw => haystack.includes(kw.toLowerCase()));
  }
}

// ── 유틸 ────────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// "24. 07. 19" 또는 "2024-07-19T..." → "YYYY-MM-DD"
function toYmd(raw: string): string {
  if (!raw) return '';
  // ISO 형식
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  // "24. 07. 19" 형식
  const short = raw.match(/(\d{2})\.\s*(\d{2})\.\s*(\d{2})/);
  if (short) return `20${short[1]}-${short[2]}-${short[3]}`;
  return '';
}

// bodyText에서 날짜 2개 추출 (시작일, 종료일)
function extractDates(text: string): [string, string] {
  const pattern = /(\d{2,4})\.\s*(\d{2})\.\s*(\d{2})/g;
  const matches = [...text.matchAll(pattern)].slice(0, 2);
  const parse   = (m: RegExpMatchArray) => {
    const y = m[1].length === 2 ? `20${m[1]}` : m[1];
    return `${y}-${m[2]}-${m[3]}`;
  };
  return [
    matches[0] ? parse(matches[0]) : '',
    matches[1] ? parse(matches[1]) : '',
  ];
}

// 레이블 텍스트 근처의 텍스트 추출
function extractNear($: cheerio.CheerioAPI, labels: string[], maxSiblings: number): string {
  for (const label of labels) {
    const el = $('*').filter((_i, e) => $(e).text().trim() === label).first();
    if (!el.length) continue;
    for (let i = 1; i <= maxSiblings; i++) {
      const next = el.next();
      const text = next.text().trim();
      if (text && text !== label) return text;
    }
  }
  return '';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
