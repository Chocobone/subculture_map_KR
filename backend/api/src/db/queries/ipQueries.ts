import { Pool } from 'pg';
import type { IP } from '../../../../../shared/types';

export async function listIPs(pool: Pool): Promise<IP[]> {
  const result = await pool.query<IP>(
    `SELECT id, name, keywords, created_at AS "createdAt"
     FROM ips ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function insertIP(
  pool: Pool,
  data: { name: string; keywords: string[] },
): Promise<IP> {
  const result = await pool.query<IP>(
    `INSERT INTO ips (name, keywords) VALUES ($1, $2)
     RETURNING id, name, keywords, created_at AS "createdAt"`,
    [data.name, data.keywords],
  );
  return result.rows[0];
}

export async function deleteIPById(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM ips WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
