import { createHash } from 'crypto';

export function hashUrl(url: string): string {
  return createHash('md5').update(url).digest('hex');
}
