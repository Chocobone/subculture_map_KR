import { Construct } from 'constructs';
import {
  Vpc, SubnetType, SecurityGroup, Port,
  IVpc, ISecurityGroup, NatProvider,
} from 'aws-cdk-lib/aws-ec2';

interface VpcNetworkProps {
  // dev: NatProvider.instance(t2.micro), prod: undefined → 기본 NAT Gateway
  natGatewayProvider?: NatProvider;
}

export class VpcNetwork extends Construct {
  readonly vpc:      IVpc;
  readonly lambdaSg: ISecurityGroup;
  readonly dbSg:     ISecurityGroup;

  constructor(scope: Construct, id: string, props: VpcNetworkProps = {}) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      natGatewayProvider: props.natGatewayProvider,
      subnetConfiguration: [
        { name: 'public',  subnetType: SubnetType.PUBLIC,                cidrMask: 24 },
        { name: 'private', subnetType: SubnetType.PRIVATE_WITH_EGRESS,   cidrMask: 24 },
      ],
    });

    this.lambdaSg = new SecurityGroup(this, 'LambdaSg', {
      vpc: this.vpc,
      description: 'Lambda functions outbound',
      allowAllOutbound: true,
    });

    this.dbSg = new SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      description: 'Aurora PostgreSQL',
      allowAllOutbound: false,
    });

    // Lambda → Aurora 5432 인바운드 허용
    this.dbSg.addIngressRule(this.lambdaSg, Port.tcp(5432), 'Lambda to Aurora');
  }
}
