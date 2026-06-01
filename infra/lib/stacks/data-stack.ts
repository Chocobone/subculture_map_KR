import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  DatabaseCluster, DatabaseClusterEngine,
  AuroraPostgresEngineVersion, ClusterInstance, Credentials,
} from 'aws-cdk-lib/aws-rds';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import { VpcNetwork } from '../constructs/VpcNetwork';

interface DataStackProps extends StackProps {
  envName: string;
}

export class DataStack extends Stack {
  readonly network:        VpcNetwork;
  readonly dbSecret:       Secret;
  readonly aurora:         DatabaseCluster;
  readonly naverApiSecret: Secret;
  readonly wsTable:        Table;
  readonly rawTable:       Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const isProd      = envName === 'prod';
    const retain      = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const ctx         = this.node.tryGetContext(envName) ?? {};

    this.network = new VpcNetwork(this, 'Network');

    // Aurora 크리덴셜 시크릿 (자동 생성)
    this.dbSecret = new Secret(this, 'DbSecret', {
      secretName: `subculture-tracker/db-${envName}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'dbadmin' }),
        generateStringKey:    'password',
        excludePunctuation:   true,
      },
    });

    // Aurora PostgreSQL Serverless v2
    this.aurora = new DatabaseCluster(this, 'Aurora', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials:              Credentials.fromSecret(this.dbSecret),
      writer:                   ClusterInstance.serverlessV2('writer'),
      serverlessV2MinCapacity:  ctx.auroraMinCapacity ?? 0.5,
      serverlessV2MaxCapacity:  ctx.auroraMaxCapacity ?? 2,
      vpc:                      this.network.vpc,
      vpcSubnets:               { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups:           [this.network.dbSg],
      defaultDatabaseName:      'subculture_tracker',
      removalPolicy:            retain,
    });

    // Naver API 크리덴셜 (배포 후 콘솔 또는 CLI로 수동 입력)
    this.naverApiSecret = new Secret(this, 'NaverApiSecret', {
      secretName:  `subculture-tracker/naver-api-${envName}`,
      description: 'Naver Cloud Platform Local Search API credentials (clientId, clientSecret)',
    });

    // WebSocket 연결 관리 테이블
    this.wsTable = new Table(this, 'WsConnections', {
      tableName:     `ws-connections-${envName}`,
      partitionKey:  { name: 'connectionId', type: AttributeType.STRING },
      billingMode:   BillingMode.PAY_PER_REQUEST,
      removalPolicy: retain,
    });

    // 크롤러 원본 저장 테이블 (urlHash 기반 중복 감지)
    this.rawTable = new Table(this, 'CrawlerRawItems', {
      tableName:     `crawler-raw-items-${envName}`,
      partitionKey:  { name: 'urlHash', type: AttributeType.STRING },
      billingMode:   BillingMode.PAY_PER_REQUEST,
      removalPolicy: retain,
    });
  }
}
