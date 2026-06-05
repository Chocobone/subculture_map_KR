import * as path from 'path';
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { SqsQueue as SqsTarget } from 'aws-cdk-lib/aws-events-targets';
import { Port, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { AppLambda } from '../constructs/AppLambda';
import { DataStack } from './data-stack';

interface CrawlerStackProps extends StackProps {
  envName:   string;
  dataStack: DataStack;
}

export class CrawlerStack extends Stack {
  constructor(scope: Construct, id: string, props: CrawlerStackProps) {
    super(scope, id, props);

    const { envName, dataStack } = props;
    const isProd = envName === 'prod';
    const { network, rawTable, dbEndpointHostname, dbSecret, naverSsmParam, ncpSsmParam } = dataStack;

    // Dead-Letter Queue (3회 실패 시 격리)
    const dlq = new Queue(this, 'CrawlerDLQ', {
      queueName:         `crawler-dlq-${envName}`,
      retentionPeriod:   Duration.days(14),
      encryption:        QueueEncryption.SQS_MANAGED,
    });

    // 크롤러 작업 Queue
    const crawlerQueue = new Queue(this, 'CrawlerQueue', {
      queueName:             `crawler-queue-${envName}`,
      visibilityTimeout:     Duration.seconds(120),
      encryption:            QueueEncryption.SQS_MANAGED,
      deadLetterQueue:       { queue: dlq, maxReceiveCount: 3 },
    });

    const repoRoot   = path.join(__dirname, '../../..');
    const lockFile   = path.join(repoRoot, 'backend/crawler/package-lock.json');
    const entryFile  = path.join(repoRoot, 'backend/crawler/src/handler.ts');

    // 크롤러 Lambda
    const crawlerFn = new AppLambda(this, 'CrawlerWorker', {
      entry:            entryFile,
      projectRoot:      repoRoot,
      depsLockFilePath: lockFile,
      timeout:          Duration.seconds(120),
      memorySize:       1024,
      logRetention:     isProd ? RetentionDays.TWO_WEEKS : RetentionDays.ONE_WEEK,
      vpc:              network.vpc,
      vpcSubnets:       { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups:   [network.lambdaSg],
      environment: {
        DYNAMO_TABLE:     rawTable.tableName,
        DB_SECRET_ARN:    dbSecret.secretArn,
        DB_HOST:          dbEndpointHostname,
        DB_NAME:          'subculture_tracker',
        NAVER_PARAM_PATH: naverSsmParam.parameterName,
        NCP_PARAM_PATH:   ncpSsmParam.parameterName,
      },
    });

    // SQS 트리거 (배치 1건씩 — 오류 격리 용이)
    crawlerFn.addEventSource(new SqsEventSource(crawlerQueue, {
      batchSize:            1,
      maxConcurrency:       5,
      reportBatchItemFailures: true,
    }));

    // DynamoDB 읽기/쓰기 권한
    rawTable.grantReadWriteData(crawlerFn);

    // Aurora 크리덴셜 시크릿 읽기 권한
    dbSecret.grantRead(crawlerFn);

    // Naver / NCP SSM 파라미터 읽기 권한
    naverSsmParam.grantRead(crawlerFn);
    ncpSsmParam.grantRead(crawlerFn);

    // Lambda → Aurora 5432 포트 허용
    network.dbSg.addIngressRule(
      network.lambdaSg,
      Port.tcp(5432),
      'Crawler Lambda → Aurora',
    );

    // EventBridge 규칙 — 매 1시간마다 SQS에 메시지 발행 (IP × 소스 조합은 별도 관리)
    new Rule(this, 'CrawlSchedule', {
      ruleName:   `crawl-schedule-${envName}`,
      schedule:   Schedule.rate(Duration.hours(1)),
      targets:    [new SqsTarget(crawlerQueue)],
      description: '매 1시간마다 크롤러 워커를 SQS를 통해 트리거',
    });
  }
}
