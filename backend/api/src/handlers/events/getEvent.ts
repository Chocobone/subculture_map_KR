import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { eventService } from '../../services/eventService';
import { ok, err } from '../../utils/response';
import { withErrorHandler } from '../../middleware/errorHandler';

const logger = new Logger({ serviceName: 'api-getEvent' });

const _handler = async (event: APIGatewayProxyEvent, _ctx: Context): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  if (!id) return err('id is required', 400);

  logger.info('GET /events/:id', { id });
  const found = await eventService.get(id);
  if (!found) return err('Event not found', 404);
  return ok(found);
};

export const handler = withErrorHandler(_handler);
