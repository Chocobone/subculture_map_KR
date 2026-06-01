import { getPool } from '../db/client';
import {
  listEvents, getEventById, insertEvent, deleteEventById,
} from '../db/queries/eventQueries';
import { cacheService } from './cacheService';
import { searchPlace } from './naverMapsService';
import type { Event, EventFilter, PaginatedResult } from '../../../../shared/types';

const CACHE_TTL = 300; // 5분

function cacheKey(filter: EventFilter): string {
  return `events:${JSON.stringify(filter)}`;
}

export const eventService = {
  async list(filter: EventFilter): Promise<PaginatedResult<Event>> {
    const key    = cacheKey(filter);
    const cached = await cacheService.get<PaginatedResult<Event>>(key);
    if (cached) return cached;

    const pool   = await getPool();
    const result = await listEvents(pool, filter);
    await cacheService.set(key, result, CACHE_TTL);
    return result;
  },

  async get(id: string): Promise<Event | null> {
    const pool = await getPool();
    return getEventById(pool, id);
  },

  async create(data: {
    ipId:       string;
    title:      string;
    type:       string;
    place?:     string;
    startDate?: string;
    endDate?:   string;
    sourceUrl?: string;
    summary?:   string;
  }): Promise<Event> {
    let placeUrl: string | null = null;
    let placeLat: number | null = null;
    let placeLng: number | null = null;

    if (data.place) {
      const info = await searchPlace(data.place);
      if (info) {
        placeUrl = info.placeUrl;
        placeLat = info.placeLat;
        placeLng = info.placeLng;
      }
    }

    const pool  = await getPool();
    const event = await insertEvent(pool, { ...data, placeUrl, placeLat, placeLng });

    await cacheService.scanDel('events:*');
    return event;
  },

  async remove(id: string): Promise<boolean> {
    const pool  = await getPool();
    const event = await getEventById(pool, id);
    if (!event) return false;

    const deleted = await deleteEventById(pool, id);
    if (deleted) await cacheService.scanDel('events:*');
    return deleted;
  },
};
