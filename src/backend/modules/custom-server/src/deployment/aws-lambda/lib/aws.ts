import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { EC2Client } from '@aws-sdk/client-ec2';
import { ECSClient } from '@aws-sdk/client-ecs';
import { IAMClient } from '@aws-sdk/client-iam';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../../env';

let awsConfig = {
  region: env.aws.AWS_REGION,
  credentials: env.aws.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: env.aws.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.aws.AWS_SECRET_ACCESS_KEY!
      }
    : undefined
};

export let awsEcs = new ECSClient(awsConfig);
export let awsIam = new IAMClient(awsConfig);
export let awsLogs = new CloudWatchLogsClient(awsConfig);
export let awsEc2 = new EC2Client(awsConfig);
export let awsS3 = new S3Client(awsConfig);
export let awsLambda = new LambdaClient(awsConfig);

export let awsAccountId = env.aws.AWS_ACCOUNT_ID;
export let awsRegion = env.aws.AWS_REGION;

if (env.aws.AWS_ACCESS_KEY_ID && !env.aws.AWS_SECRET_ACCESS_KEY) {
  throw new Error('AWS_SECRET_ACCESS_KEY must be set if AWS_ACCESS_KEY_ID is set');
}

if (env.aws.AWS_ACCOUNT_ID && !env.aws.AWS_REGION) {
  throw new Error('AWS_REGION must be set if AWS_ACCOUNT_ID is set');
}

if (env.aws.AWS_ACCOUNT_ID && !env.aws.AWS_ACCOUNT_ID) {
  throw new Error('AWS_ACCESS_KEY_ID must be set if AWS_ACCOUNT_ID is set');
}

export let getResourceName = (name: string) => {
  let prefix = env.aws.LAMBDA_DEPLOY_RESOURCE_PREFIX;
  let inner = `metorial-csrv1-${name}`;
  return prefix ? `${prefix}-${inner}` : inner;
};
