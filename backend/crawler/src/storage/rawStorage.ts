import {
  DynamoDBClient,
  ConditionalCheckFailedException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { RawItem } from '../crawlers/BaseCrawler';
import { hashUrl } from '../utils/dedup';

const TABLE = process.env.DYNAMO_TABLE ?? 'crawler-raw-items-dev';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const rawStorage = {
  async isDuplicate(url: string): Promise<boolean> {
    const res = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key:       { urlHash: hashUrl(url) },
      ProjectionExpression: 'urlHash',
    }));
    return res.Item !== undefined;
  },

  async save(item: RawItem & { ipId: string }): Promise<void> {
    try {
      await ddb.send(new PutCommand({
        TableName:           TABLE,
        Item:                { urlHash: hashUrl(item.url), ...item },
        ConditionExpression: 'attribute_not_exists(urlHash)',
      }));
    } catch (e) {
      if (e instanceof ConditionalCheckFailedException) return;
      throw e;
    }
  },
};
