import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { ipService } from '../../services/ipService';
import { ok } from '../../utils/response';
import { withErrorHandler } from '../../middleware/errorHandler';

const logger = new Logger({ serviceName: 'api-getIPs' });

const _handler = async (_event: APIGatewayProxyEvent, _ctx: Context): Promise<APIGatewayProxyResult> => {
  logger.info('GET /ips');
  const ips = await ipService.list();
  return ok(ips);
};

export const handler = withErrorHandler(_handler);
