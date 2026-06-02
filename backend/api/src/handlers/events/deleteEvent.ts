import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { eventService } from '../../services/eventService';
import { ok, err } from '../../utils/response';
import { withErrorHandler } from '../../middleware/errorHandler';

const logger = new Logger({ serviceName: 'api-deleteEvent' });

const _handler = async (event: APIGatewayProxyEvent, _ctx: Context): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  if (!id) return err('id is required', 400);

  logger.info('DELETE /events/:id', { id });
  const deleted = await eventService.remove(id);
  if (!deleted) return err('Event not found', 404);
  return ok(null, 204);
};

export const handler = withErrorHandler(_handler);
