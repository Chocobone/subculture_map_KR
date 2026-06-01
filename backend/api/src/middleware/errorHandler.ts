import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { err } from '../utils/response';

const logger = new Logger({ serviceName: 'api-errorHandler' });

type AsyncHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<APIGatewayProxyResult>;

export function withErrorHandler(fn: AsyncHandler): AsyncHandler {
  return async (event, context) => {
    try {
      return await fn(event, context);
    } catch (e) {
      logger.error('Unhandled error', { error: e });
      return err('Internal server error', 500);
    }
  };
}
