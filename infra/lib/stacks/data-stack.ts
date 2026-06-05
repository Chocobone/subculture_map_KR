import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  DatabaseCluster, DatabaseClusterEngine,
  AuroraPostgresEngineVersion, ClusterInstance, Credentials,
  CfnDBCluster,
  DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion,
} from 'aws-cdk-lib/aws-rds';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { SubnetType, NatProvider, InstanceType, InstanceClass, InstanceSize } from 'aws-cdk-lib/aws-ec2';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { VpcNetwork } from '../constructs/VpcNetwork';

interface DataStackProps extends StackProps {
  envName: string;
}

export class DataStack extends Stack {
  readonly network:            VpcNetwork;
  readonly dbSecret:           Secret;
  readonly dbEndpointHostname: string;
  readonly naverSsmParam:      StringParameter;
  readonly ncpSsmParam:        StringParameter;
  readonly wsTable:            Table;
  readonly rawTable:           Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const isProd      = envName === 'prod';
    const retain      = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;
    const ctx         = this.node.tryGetContext(envName) ?? {};

    // dev: EC2 t2.micro NAT Instance (12개월 무료), prod: 기본 NAT Gateway
    const natGatewayProvider = isProd
      ? undefined
      : NatProvider.instance({
          instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
        });

    this.network = new VpcNetwork(this, 'Network', { natGatewayProvider });

    // Aurora 크리덴셜 시크릿 (자동 생성)
    this.dbSecret = new Secret(this, 'DbSecret', {
      secretName: `subculture-tracker/db-${envName}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'dbadmin' }),
        generateStringKey:    'password',
        excludePunctuation:   true,
      },
    });

    if (isProd) {
      // prod: Aurora PostgreSQL Serverless v2 (기존 사양 유지)
      const aurora = new DatabaseCluster(this, 'Aurora', {
        engine: DatabaseClusterEngine.auroraPostgres({
          version: AuroraPostgresEngineVersion.VER_15_4,
        }),
        credentials:             Credentials.fromSecret(this.dbSecret),
        writer:                  ClusterInstance.serverlessV2('writer'),
        serverlessV2MinCapacity: ctx.auroraMinCapacity ?? 1,
        serverlessV2MaxCapacity: ctx.auroraMaxCapacity ?? 8,
        vpc:                     this.network.vpc,
        vpcSubnets:              { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups:          [this.network.dbSg],
        defaultDatabaseName:     'subculture_tracker',
        removalPolicy:           retain,
      });
      (aurora.node.defaultChild as CfnDBCluster)
        .addPropertyOverride('WithExpressConfiguration', true);
      this.dbEndpointHostname = aurora.clusterEndpoint.hostname;
    } else {
      // dev: RDS PostgreSQL db.t3.micro (12개월 무료 플랜)
      const rds = new DatabaseInstance(this, 'RdsInstance', {
        engine:               DatabaseInstanceEngine.postgres({
                                version: PostgresEngineVersion.VER_15_4 }),
        instanceType:         InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
        credentials:          Credentials.fromSecret(this.dbSecret),
        vpc:                  this.network.vpc,
        vpcSubnets:           { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups:       [this.network.dbSg],
        databaseName:         'subculture_tracker',
        removalPolicy:        retain,
        multiAz:              false,
        allocatedStorage:     20,
        maxAllocatedStorage:  20,
        backupRetention:      Duration.days(1),
        deleteAutomatedBackups: true,
      });
      this.dbEndpointHostname = rds.instanceEndpoint.hostname;
    }

    // Naver 자격증명 — SSM Parameter Store (무료 플랜)
    // 배포 후 아래 CLI로 실제 값 입력:
    //   aws ssm put-parameter --name "/subculture-tracker/{env}/naver-api" \
    //     --type SecureString --value '{"clientId":"...","clientSecret":"..."}' --overwrite
    this.naverSsmParam = new StringParameter(this, 'NaverApiParam', {
      parameterName: `/subculture-tracker/${envName}/naver-api`,
      stringValue:   'PLACEHOLDER',
      description:   'Naver Developers Local Search API 자격증명 JSON {clientId, clientSecret}',
    });

    this.ncpSsmParam = new StringParameter(this, 'NcpApiParam', {
      parameterName: `/subculture-tracker/${envName}/ncp-api`,
      stringValue:   'PLACEHOLDER',
      description:   'Naver Cloud Platform Geocoding API 자격증명 JSON {clientId, clientSecret}',
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
