import { DescribeLogStreamsCommand } from '@aws-sdk/client-cloudwatch-logs';
import {
  BatchGetProjectsCommand,
  ListBuildsForProjectCommand
} from '@aws-sdk/client-codebuild';
import { delay } from '@mtsrc/delay';
import { env } from '../../env';
import { codebuild, logsClient } from './codeBuild';
import { ensureProject } from './project';

let defaultLogGroupName = '/metorial/forge/codebuild';

export let checkCodeBuildAccess = async () => {
  if (env.provider.DEFAULT_PROVIDER !== 'aws.code-build') return;
  if (!codebuild || !logsClient) throw new Error('CodeBuild client not initialized');

  let attempts = 0;
  let maxAttempts = 5;
  let lastError: unknown;

  while (attempts < maxAttempts) {
    attempts += 1;

    try {
      let project = await ensureProject();
      let projectName = project.projectName;

      await codebuild.send(new BatchGetProjectsCommand({ names: [projectName] }));
      await codebuild.send(
        new ListBuildsForProjectCommand({
          projectName,
          sortOrder: 'DESCENDING'
        })
      );

      let logGroupName = env.codeBuild.CODE_BUILD_LOG_GROUP_NAME || defaultLogGroupName;
      await logsClient.send(
        new DescribeLogStreamsCommand({
          logGroupName,
          limit: 1
        })
      );

      console.log('Successfully verified CodeBuild access');

      return;
    } catch (err) {
      lastError = err;
      await delay(2000 * attempts);
    }
  }

  throw new Error(
    `CodeBuild access check failed after ${maxAttempts} attempts: ${
      (lastError as Error)?.message ?? String(lastError)
    }`
  );
};
