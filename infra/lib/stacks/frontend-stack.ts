import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import {
  Distribution, ViewerProtocolPolicy, CachePolicy,
  AllowedMethods, CachedMethods,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ARecord, RecordTarget, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';

interface FrontendStackProps extends StackProps {
  envName:     string;
  domainName:  string;
  certificate: ICertificate;
  hostedZone:  IHostedZone;
}

export class FrontendStack extends Stack {
  readonly bucketName:     string;
  readonly distributionId: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { envName, domainName, certificate, hostedZone } = props;
    const isProd  = envName === 'prod';
    const retain  = isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // 정적 호스팅 버킷 — 퍼블릭 직접 접근 차단, OAC 경유만 허용
    const siteBucket = new Bucket(this, 'SiteBucket', {
      bucketName:        `subculture-tracker-frontend-${envName}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy:     retain,
      autoDeleteObjects: !isProd,
    });

    // CloudFront 배포
    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin:               S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:          CachePolicy.CACHING_OPTIMIZED,
        allowedMethods:       AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods:        CachedMethods.CACHE_GET_HEAD,
      },
      domainNames:       [domainName],
      certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        // React Router SPA — 404/403을 index.html로 fallback
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // Route53 A Alias 레코드 → CloudFront
    new ARecord(this, 'AliasRecord', {
      zone:   hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    this.bucketName     = siteBucket.bucketName;
    this.distributionId = distribution.distributionId;

    new CfnOutput(this, 'BucketName',      { value: siteBucket.bucketName });
    new CfnOutput(this, 'DistributionId',  { value: distribution.distributionId });
    new CfnOutput(this, 'DistributionUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'DomainUrl',       { value: `https://${domainName}` });
  }
}
