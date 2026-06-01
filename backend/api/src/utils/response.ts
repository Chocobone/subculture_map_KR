import { APIGatewayProxyResult } from 'aws-lambda';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export const ok = (data: unknown, statusCode = 200): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify({ success: true, data }),
});

export const err = (message: string, statusCode = 500): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify({ success: false, message }),
});
