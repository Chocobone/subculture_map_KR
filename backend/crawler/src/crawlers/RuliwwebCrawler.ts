import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseCrawler, RawItem } from './BaseCrawler';

const BASE_URL   = 'https://bbs.ruliweb.com';
const SEARCH_URL = `${BASE_URL}/search`;
const UA         = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_ITEMS  = 20;

export class RuliwwebCrawler extends BaseCrawler {
  readonly source = 'ruliweb' as const;

  async fetch(keywords: string[]): Promise<RawItem[]> {
    const query = this.buildSearchQuery(keywords);
    const html  = await this.fetchSearchPage(query);
    return this.parseItems(html);
  }

  private async fetchSearchPage(query: string): Promise<string> {
    const resp = await axios.get(SEARCH_URL, {
      params:  { q: query, r: 'content' },
      headers: { 'User-Agent': UA },
      timeout: 10_000,
    });
    return resp.data as string;
  }

  private parseItems(html: string): RawItem[] {
    const $       = cheerio.load(html);
    const items:  RawItem[] = [];
    const now     = new Date().toISOString();

    $('table.board_list_table tbody tr').each((_i, el) => {
      if (items.length >= MAX_ITEMS) return false;

      const anchor = $(el).find('td.subject a.deco').first();
      const title  = anchor.text().trim();
      const href   = anchor.attr('href') ?? '';

      if (!title || !href) return;

      const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      items.push({ url, text: title, source: this.source, crawledAt: now });
    });

    return items;
  }
}
