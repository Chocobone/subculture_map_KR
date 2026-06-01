import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { eventService } from '../../services/eventService';
import { ok } from '../../utils/response';
import { withErrorHandler } from '../../middleware/errorHandler';
import type { EventFilter } from '../../../../../shared/types';

const logger = new Logger({ serviceName: 'api-getEvents' });

const _handler = async (event: APIGatewayProxyEvent, _ctx: Context): Promise<APIGatewayProxyResult> => {
  const q = event.queryStringParameters ?? {};
  const filter: EventFilter = {
    ipId:   q.ipId    ?? undefined,
    type:   q.type    as EventFilter['type']   ?? undefined,
    status: q.status  as EventFilter['status'] ?? undefined,
    page:   Math.max(1, Number(q.page  ?? 1)),
    limit:  Math.min(100, Math.max(1, Number(q.limit ?? 20))),
  };

  logger.info('GET /events', { filter });
  const result = await eventService.list(filter);
  return ok(result);
};

export const handler = withErrorHandler(_handler);
