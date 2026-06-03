import { SQSHandler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { crawlerFactory } from './crawlers/crawlerFactory';
import { rawStorage } from './storage/rawStorage';
import { eventStorage } from './storage/eventStorage';
import { searchPlace } from './utils/naverMapsService';
import type { CrawlSource } from '../../../shared/types';

const logger = new Logger({ serviceName: 'crawler-worker' });

interface CrawlMessage {
  ipId:     string;
  ipName:   string;
  source:   CrawlSource;
  keywords: string[];
}

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    let msg: CrawlMessage;
    try {
      msg = JSON.parse(record.body) as CrawlMessage;
    } catch {
      logger.error('SQS 메시지 파싱 실패', { body: record.body });
      continue;
    }

    const { ipId, ipName, source, keywords } = msg;
    logger.info('크롤링 시작', { ipId, ipName, source });

    let crawler;
    try {
      crawler = crawlerFactory(source);
    } catch (e) {
      logger.error('크롤러 생성 실패', { source, error: (e as Error).message });
      continue;
    }

    let rawItems;
    try {
      rawItems = await crawler.fetch(keywords);
    } catch (e) {
      logger.error('크롤링 실패', { source, error: (e as Error).message });
      continue;
    }

    logger.info('크롤링 완료', { source, count: rawItems.length });

    for (const raw of rawItems) {
      const isDup = await rawStorage.isDuplicate(raw.url);
      if (isDup) {
        logger.debug('중복 URL 건너뜀', { url: raw.url });
        continue;
      }

      await rawStorage.save({ ...raw, ipId });
      logger.info('원본 저장 완료', { url: raw.url });

      if (source === 'popga') {
        // 구조화 데이터 — Bedrock 없이 직접 Aurora 저장
        try {
          const structured = JSON.parse(raw.text) as {
            title: string; type: 'popup' | 'collab' | 'goods' | 'limited';
            place: string; startDate: string; endDate: string; summary: string;
          };
          const coords = await searchPlace(structured.place);
          await eventStorage.upsert({
            ...structured,
            ipId,
            sourceUrl: raw.url,
            ...eventStorage.fromPlaceInfo(coords),
          });
          logger.info('Aurora 행사 저장 완료', { url: raw.url, title: structured.title });
        } catch (e) {
          logger.error('Aurora 저장 실패', { url: raw.url, error: (e as Error).message });
        }
      }
      // 그 외 소스(ruliweb 등)는 Issue #4에서 Bedrock 연동 추가 예정
    }
  }
};
