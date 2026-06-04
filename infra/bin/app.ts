import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DataStack }     from '../lib/stacks/data-stack';
import { ApiStack }      from '../lib/stacks/api-stack';
import { CrawlerStack }  from '../lib/stacks/crawler-stack';
import { CertStack }     from '../lib/stacks/cert-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';

const app     = new cdk.App();
const envName = (app.node.tryGetContext('env') as string | undefined) ?? 'dev';
const ctx     = app.node.tryGetContext(envName) ?? {};

const account    = process.env.CDK_DEFAULT_ACCOUNT;
const envAp      = { account, region: 'ap-northeast-2' };
const envUsEast1 = { account, region: 'us-east-1' };

const dataStack = new DataStack(app, `SubcultureTracker-Data-${envName}`, {
  env: envAp, envName,
});
new ApiStack(app, `SubcultureTracker-Api-${envName}`, {
  env: envAp, envName, dataStack,
});
new CrawlerStack(app, `SubcultureTracker-Crawler-${envName}`, {
  env: envAp, envName, dataStack,
});

if (ctx.domainName) {
  const certStack = new CertStack(app, `SubcultureTracker-Cert-${envName}`, {
    env:                  envUsEast1,
    crossRegionReferences: true,
    envName,
    domainName:           ctx.domainName,
  });

  new FrontendStack(app, `SubcultureTracker-Frontend-${envName}`, {
    env:                  envAp,
    crossRegionReferences: true,
    envName,
    domainName:           ctx.domainName,
    certificate:          certStack.certificate,
    hostedZone:           certStack.hostedZone,
  });
}
