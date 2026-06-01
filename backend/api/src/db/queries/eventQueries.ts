import { Pool } from 'pg';
import type { Event, EventFilter, PaginatedResult } from '../../../../../shared/types';

const SELECT_COLS = `
  id,
  ip_id       AS "ipId",
  title,
  type,
  place,
  place_url   AS "placeUrl",
  place_lat   AS "placeLat",
  place_lng   AS "placeLng",
  start_date  AS "startDate",
  end_date    AS "endDate",
  source_url  AS "sourceUrl",
  status,
  summary,
  created_at  AS "createdAt",
  updated_at  AS "updatedAt"
`;

export async function listEvents(
  pool: Pool,
  filter: EventFilter,
): Promise<PaginatedResult<Event>> {
  const conditions: string[] = [];
  const values: unknown[]   = [];

  if (filter.ipId)   { conditions.push(`ip_id = $${values.push(filter.ipId)}`);   }
  if (filter.type)   { conditions.push(`type   = $${values.push(filter.type)}`);   }
  if (filter.status) { conditions.push(`status = $${values.push(filter.status)}`); }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (filter.page - 1) * filter.limit;

  const limitIdx  = values.length + 1;
  const offsetIdx = values.length + 2;

  const [countRow, rows] = await Promise.all([
    pool.query<{ count: string }>(`SELECT COUNT(*) FROM events ${where}`, values),
    pool.query<Event>(
      `SELECT ${SELECT_COLS} FROM events ${where}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...values, filter.limit, offset],
    ),
  ]);

  return {
    items: rows.rows,
    total: Number(countRow.rows[0].count),
    page:  filter.page,
    limit: filter.limit,
  };
}

export async function getEventById(pool: Pool, id: string): Promise<Event | null> {
  const result = await pool.query<Event>(
    `SELECT ${SELECT_COLS} FROM events WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function insertEvent(
  pool: Pool,
  data: {
    ipId:      string;
    title:     string;
    type:      string;
    place?:    string;
    placeUrl?: string | null;
    placeLat?: number | null;
    placeLng?: number | null;
    startDate?: string;
    endDate?:   string;
    sourceUrl?: string;
    summary?:   string;
  },
): Promise<Event> {
  const result = await pool.query<Event>(
    `INSERT INTO events
       (ip_id, title, type, place, place_url, place_lat, place_lng,
        start_date, end_date, source_url, summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${SELECT_COLS}`,
    [
      data.ipId,       data.title,             data.type,
      data.place       ?? null,
      data.placeUrl    ?? null,
      data.placeLat    ?? null,
      data.placeLng    ?? null,
      data.startDate   ?? null,
      data.endDate     ?? null,
      data.sourceUrl   ?? null,
      data.summary     ?? null,
    ],
  );
  return result.rows[0];
}

export async function deleteEventById(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM events WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
