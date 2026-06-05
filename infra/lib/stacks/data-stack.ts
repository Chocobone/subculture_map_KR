import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion, Credentials,
} from 'aws-cdk-lib/aws-rds';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { SubnetType, NatInstanceProviderV2, InstanceType, InstanceClass, InstanceSize } from 'aws-cdk-lib/aws-ec2';
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
    const isProd = envName === 'prod';
    const retain = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // dev: t3.nano (~$4/월) / prod: t3.micro (~$10/월) — 양 환경 모두 NAT Instance (AL2023)
    const natGatewayProvider = new NatInstanceProviderV2({
      instanceType: isProd
        ? InstanceType.of(InstanceClass.T3, InstanceSize.MICRO)
        : InstanceType.of(InstanceClass.T3, InstanceSize.NANO),
    });

    this.network = new VpcNetwork(this, 'Network', { natGatewayProvider });

    // DB 크리덴셜 시크릿 (자동 생성)
    this.dbSecret = new Secret(this, 'DbSecret', {
      secretName: `subculture-tracker/db-${envName}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'dbadmin' }),
        generateStringKey:    'password',
        excludePunctuation:   true,
      },
    });

    // RDS PostgreSQL db.t3.micro — dev: 20GB·1일 백업, prod: 50GB·7일 백업
    const allocatedStorage = isProd ? 50 : 20;
    const backupDays       = isProd ? 7  : 1;

    const rds = new DatabaseInstance(this, 'RdsInstance', {
      engine:                 DatabaseInstanceEngine.postgres({
                                version: PostgresEngineVersion.of('15.18', '15') }),
      instanceType:           InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      credentials:            Credentials.fromSecret(this.dbSecret),
      vpc:                    this.network.vpc,
      vpcSubnets:             { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups:         [this.network.dbSg],
      databaseName:           'subculture_tracker',
      removalPolicy:          retain,
      multiAz:                false,
      allocatedStorage,
      maxAllocatedStorage:    allocatedStorage,
      backupRetention:        Duration.days(backupDays),
      deleteAutomatedBackups: !isProd,
    });
    this.dbEndpointHostname = rds.instanceEndpoint.hostname;

    // Naver 자격증명 — SSM Parameter Store
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
