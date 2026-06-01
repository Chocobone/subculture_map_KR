import type { CrawlSource } from '../../../../shared/types';
import { BaseCrawler } from './BaseCrawler';
import { RuliwwebCrawler } from './RuliwwebCrawler';

export function crawlerFactory(source: CrawlSource): BaseCrawler {
  switch (source) {
    case 'ruliweb':    return new RuliwwebCrawler();
    // 추후 이슈에서 순차 추가
    case 'fmkorea':
    case 'twitter':
    case 'naver-cafe':
    case 'dcinside':
      throw new Error(`${source} 크롤러는 아직 구현되지 않았습니다.`);
    default: {
      const _: never = source;
      throw new Error(`알 수 없는 소스: ${_}`);
    }
  }
}
