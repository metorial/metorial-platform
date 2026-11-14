import { LambdaClient } from '@aws-sdk/client-lambda';
import { env } from '../../env';

export let lambdaClient =
  env.provider.DEFAULT_PROVIDER == 'aws.lambda'
    ? new LambdaClient({
        region: env.lambda.LAMBDA_AWS_REGION,
        credentials:
          env.lambda.LAMBDA_AWS_ACCESS_KEY_ID && env.lambda.LAMBDA_AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.lambda.LAMBDA_AWS_ACCESS_KEY_ID,
                secretAccessKey: env.lambda.LAMBDA_AWS_SECRET_ACCESS_KEY
              }
            : undefined
      })
    : undefined;
