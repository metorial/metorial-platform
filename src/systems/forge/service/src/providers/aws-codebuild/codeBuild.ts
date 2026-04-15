import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { CodeBuildClient } from '@aws-sdk/client-codebuild';
import { env } from '../../env';

export let codebuild =
  env.provider.DEFAULT_PROVIDER == 'aws.code-build'
    ? new CodeBuildClient({
        region: env.codeBuild.CODE_BUILD_AWS_REGION,
        credentials:
          env.codeBuild.CODE_BUILD_AWS_ACCESS_KEY_ID &&
          env.codeBuild.CODE_BUILD_AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.codeBuild.CODE_BUILD_AWS_ACCESS_KEY_ID,
                secretAccessKey: env.codeBuild.CODE_BUILD_AWS_SECRET_ACCESS_KEY
              }
            : undefined,

        maxAttempts: 25
      })
    : undefined;

export let logsClient =
  env.provider.DEFAULT_PROVIDER == 'aws.code-build'
    ? new CloudWatchLogsClient({
        region: env.codeBuild.CODE_BUILD_AWS_REGION,
        credentials:
          env.codeBuild.CODE_BUILD_AWS_ACCESS_KEY_ID &&
          env.codeBuild.CODE_BUILD_AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.codeBuild.CODE_BUILD_AWS_ACCESS_KEY_ID,
                secretAccessKey: env.codeBuild.CODE_BUILD_AWS_SECRET_ACCESS_KEY
              }
            : undefined
      })
    : undefined;
