import { getPool } from '../db/client';
import { listIPs, insertIP, deleteIPById } from '../db/queries/ipQueries';
import type { IP } from '../../../../shared/types';

export const ipService = {
  async list(): Promise<IP[]> {
    const pool = await getPool();
    return listIPs(pool);
  },

  async create(data: { name: string; keywords: string[] }): Promise<IP> {
    const pool = await getPool();
    return insertIP(pool, data);
  },

  async remove(id: string): Promise<boolean> {
    const pool = await getPool();
    return deleteIPById(pool, id);
  },
};
