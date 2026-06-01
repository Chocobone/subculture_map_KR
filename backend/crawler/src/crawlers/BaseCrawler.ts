export interface RawItem {
  url:       string;
  text:      string;
  source:    string;
  crawledAt: string;
}

export abstract class BaseCrawler {
  abstract readonly source: string;
  abstract fetch(keywords: string[]): Promise<RawItem[]>;

  protected buildSearchQuery(keywords: string[]): string {
    const keywordPart = keywords.map(k => `"${k}"`).join(' OR ');
    return `(${keywordPart}) AND (팝업 OR 콜라보 OR 굿즈 OR 한정)`;
  }
}
