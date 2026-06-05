import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { Runtime, Architecture } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export type AppLambdaProps = Omit<NodejsFunctionProps, 'runtime' | 'architecture'>;

export class AppLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: AppLambdaProps) {
    super(scope, id, {
      runtime:        Runtime.NODEJS_20_X,
      architecture:   Architecture.ARM_64,
      timeout:        Duration.seconds(30),
      memorySize:     512,
      logRetention:   RetentionDays.ONE_WEEK,
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/*'],
      },
      ...props,
      environment: {
        POWERTOOLS_SERVICE_NAME: id,
        LOG_LEVEL:               'INFO',
        ...(props.environment ?? {}),
      },
    });
  }
}
