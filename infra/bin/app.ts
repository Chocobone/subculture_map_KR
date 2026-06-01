import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataStack }     from '../lib/stacks/data-stack';
import { ApiStack }      from '../lib/stacks/api-stack';
import { CrawlerStack }  from '../lib/stacks/crawler-stack';

const app     = new cdk.App();
const envName = (app.node.tryGetContext('env') as string | undefined) ?? 'dev';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region:  process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-2',
};

const dataStack = new DataStack(app, `SubcultureTracker-Data-${envName}`, { env, envName });
new ApiStack(app, `SubcultureTracker-Api-${envName}`, { env, envName, dataStack });
new CrawlerStack(app, `SubcultureTracker-Crawler-${envName}`, { env, envName, dataStack });
