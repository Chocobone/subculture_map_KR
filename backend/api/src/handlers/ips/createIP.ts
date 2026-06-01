import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { ipService } from '../../services/ipService';
import { ok, err } from '../../utils/response';
import { withErrorHandler } from '../../middleware/errorHandler';

const logger = new Logger({ serviceName: 'api-createIP' });

const _handler = async (event: APIGatewayProxyEvent, _ctx: Context): Promise<APIGatewayProxyResult> => {
  const body = JSON.parse(event.body ?? '{}');
  const { name, keywords } = body;

  if (!name)                              return err('name is required', 400);
  if (!Array.isArray(keywords) || keywords.length === 0) return err('keywords must be a non-empty array', 400);

  logger.info('POST /ips', { name });
  const created = await ipService.create({ name, keywords });
  return ok(created, 201);
};

export const handler = withErrorHandler(_handler);
