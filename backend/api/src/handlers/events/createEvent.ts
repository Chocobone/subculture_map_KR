import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { eventService } from '../../services/eventService';
import { ok, err } from '../../utils/response';
import { withErrorHandler } from '../../middleware/errorHandler';

const logger = new Logger({ serviceName: 'api-createEvent' });

const VALID_TYPES = new Set(['popup', 'collab', 'goods', 'limited']);

const _handler = async (event: APIGatewayProxyEvent, _ctx: Context): Promise<APIGatewayProxyResult> => {
  const body = JSON.parse(event.body ?? '{}');
  const { ipId, title, type, place, startDate, endDate, sourceUrl, summary } = body;

  if (!ipId)              return err('ipId is required', 400);
  if (!title)             return err('title is required', 400);
  if (!VALID_TYPES.has(type)) return err('type must be one of: popup, collab, goods, limited', 400);

  logger.info('POST /events', { ipId, title, type, place });
  const created = await eventService.create({ ipId, title, type, place, startDate, endDate, sourceUrl, summary });
  return ok(created, 201);
};

export const handler = withErrorHandler(_handler);
