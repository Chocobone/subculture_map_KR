import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';

interface CertStackProps extends StackProps {
  envName:    string;
  domainName: string;
}

export class CertStack extends Stack {
  readonly certificate: Certificate;
  readonly hostedZone:  HostedZone;

  constructor(scope: Construct, id: string, props: CertStackProps) {
    super(scope, id, props);

    const { domainName } = props;

    // subculture.chocobone.dev 전용 Hosted Zone
    // 배포 후 NS 레코드 4개를 chocobone.dev 등록기관에 위임 등록해야 한다
    this.hostedZone = new HostedZone(this, 'HostedZone', {
      zoneName: domainName,
    });

    // CloudFront는 us-east-1 인증서만 허용하므로 이 스택은 반드시 us-east-1에서 생성
    this.certificate = new Certificate(this, 'Certificate', {
      domainName,
      validation: CertificateValidation.fromDns(this.hostedZone),
    });
  }
}
