import { getPool } from '../db/client';
import type { PlaceInfo } from '../utils/naverMapsService';

export interface EventUpsertParams {
  ipId:      string;
  title:     string;
  type:      'popup' | 'collab' | 'goods' | 'limited';
  place:     string;
  startDate: string;
  endDate:   string;
  summary:   string;
  sourceUrl: string;
  placeLat:  number | null;
  placeLng:  number | null;
  placeUrl:  string | null;
}

export const eventStorage = {
  async upsert(params: EventUpsertParams): Promise<void> {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO events
         (ip_id, title, type, place,
          place_lat, place_lng, place_url,
          start_date, end_date, source_url, summary, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               NULLIF($8, '')::date, NULLIF($9, '')::date,
               $10, $11, 'upcoming')
       ON CONFLICT (source_url) DO UPDATE SET
         title      = EXCLUDED.title,
         type       = EXCLUDED.type,
         place      = EXCLUDED.place,
         place_lat  = EXCLUDED.place_lat,
         place_lng  = EXCLUDED.place_lng,
         place_url  = EXCLUDED.place_url,
         start_date = EXCLUDED.start_date,
         end_date   = EXCLUDED.end_date,
         summary    = EXCLUDED.summary,
         updated_at = now()`,
      [
        params.ipId,
        params.title,
        params.type,
        params.place,
        params.placeLat,
        params.placeLng,
        params.placeUrl,
        params.startDate,
        params.endDate,
        params.sourceUrl,
        params.summary,
      ],
    );
  },

  fromPlaceInfo(info: PlaceInfo | null): Pick<EventUpsertParams, 'placeLat' | 'placeLng' | 'placeUrl'> {
    return {
      placeLat: info?.placeLat ?? null,
      placeLng: info?.placeLng ?? null,
      placeUrl: info?.placeUrl ?? null,
    };
  },
};
