import * as path from 'path';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RestApi, LambdaIntegration, Cors } from 'aws-cdk-lib/aws-apigateway';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { AppLambda } from '../constructs/AppLambda';
import { DataStack } from './data-stack';

interface ApiStackProps extends StackProps {
  envName:   string;
  dataStack: DataStack;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { envName, dataStack } = props;
    const isProd = envName === 'prod';
    const { network, dbEndpointHostname, dbSecret, naverSsmParam, ncpSsmParam } = dataStack;

    // 모든 Lambda에 공통으로 주입되는 환경 변수
    const commonEnv: Record<string, string> = {
      DB_HOST:       dbEndpointHostname,
      DB_NAME:       'subculture_tracker',
      DB_SECRET_ARN: dbSecret.secretArn,
      // REDIS_URL은 Stage 5 ElastiCache 배포 후 추가
      REDIS_URL:     '',
    };

    // Lambda 공통 VPC 설정
    const vpcConfig = {
      vpc:            network.vpc,
      vpcSubnets:     { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [network.lambdaSg],
    };

    const handlersDir = path.join(__dirname, '../../../backend/api/src/handlers');

    // 모노레포에서 entry 파일이 infra/ 외부에 있으므로 projectRoot를 레포 루트로 설정
    const repoRoot    = path.join(__dirname, '../../..');
    const lockFile    = path.join(repoRoot, 'backend/api/package-lock.json');
    const lambdaBase  = {
      ...vpcConfig,
      projectRoot:      repoRoot,
      depsLockFilePath: lockFile,
      logRetention:     isProd ? RetentionDays.TWO_WEEKS : RetentionDays.ONE_WEEK,
    };

    // ── Events ──
    const getEvents = new AppLambda(this, 'GetEventsFunction', {
      entry:       path.join(handlersDir, 'events/getEvents.ts'),
      environment: { ...commonEnv },
      ...lambdaBase,
    });

    const getEvent = new AppLambda(this, 'GetEventFunction', {
      entry:       path.join(handlersDir, 'events/getEvent.ts'),
      environment: { ...commonEnv },
      ...lambdaBase,
    });

    const createEvent = new AppLambda(this, 'CreateEventFunction', {
      entry:       path.join(handlersDir, 'events/createEvent.ts'),
      environment: {
        ...commonEnv,
        NAVER_PARAM_PATH: naverSsmParam.parameterName,
        NCP_PARAM_PATH:   ncpSsmParam.parameterName,
      },
      ...lambdaBase,
    });

    const deleteEvent = new AppLambda(this, 'DeleteEventFunction', {
      entry:       path.join(handlersDir, 'events/deleteEvent.ts'),
      environment: { ...commonEnv },
      ...lambdaBase,
    });

    // ── IPs ──
    const getIPs = new AppLambda(this, 'GetIPsFunction', {
      entry:       path.join(handlersDir, 'ips/getIPs.ts'),
      environment: { ...commonEnv },
      ...lambdaBase,
    });

    const createIP = new AppLambda(this, 'CreateIPFunction', {
      entry:       path.join(handlersDir, 'ips/createIP.ts'),
      environment: { ...commonEnv },
      ...lambdaBase,
    });

    const deleteIP = new AppLambda(this, 'DeleteIPFunction', {
      entry:       path.join(handlersDir, 'ips/deleteIP.ts'),
      environment: { ...commonEnv },
      ...lambdaBase,
    });

    // ── IAM 권한 ──
    [getEvents, getEvent, createEvent, deleteEvent, getIPs, createIP, deleteIP]
      .forEach(fn => dbSecret.grantRead(fn));
    naverSsmParam.grantRead(createEvent);
    ncpSsmParam.grantRead(createEvent);

    // ── REST API Gateway ──
    const api = new RestApi(this, 'RestApi', {
      restApiName: `subculture-tracker-api-${envName}`,
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const events   = api.root.addResource('events');
    const eventId  = events.addResource('{id}');
    events.addMethod('GET',    new LambdaIntegration(getEvents));
    events.addMethod('POST',   new LambdaIntegration(createEvent));
    eventId.addMethod('GET',    new LambdaIntegration(getEvent));
    eventId.addMethod('DELETE', new LambdaIntegration(deleteEvent));

    const ips  = api.root.addResource('ips');
    const ipId = ips.addResource('{id}');
    ips.addMethod('GET',      new LambdaIntegration(getIPs));
    ips.addMethod('POST',     new LambdaIntegration(createIP));
    ipId.addMethod('DELETE',  new LambdaIntegration(deleteIP));
  }
}
