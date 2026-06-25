import { PutRetentionPolicyCommand } from '@aws-sdk/client-cloudwatch-logs';
import {
  BatchGetProjectsCommand,
  CreateProjectCommand,
  UpdateProjectCommand,
  type CreateProjectCommandInput
} from '@aws-sdk/client-codebuild';
import { once } from '@lowerdeck/once';
import { env } from '../../env';
import { codebuild, logsClient } from './codeBuild';
import { ensureCodeBuildRole } from './role';

let ProjectName =
  env.codeBuild.CODE_BUILD_PROJECT_NAME || 'metorial-forge-codebuild-project-v1';

export let ensureProject = once(async () => {
  if (!codebuild || !logsClient) throw new Error('CodeBuild client not initialized');

  let serviceRoleArn = await ensureCodeBuildRole();

  let getResp = await codebuild.send(new BatchGetProjectsCommand({ names: [ProjectName] }));

  let exists = getResp.projects && getResp.projects.length > 0;

  let logGroupName = env.codeBuild.CODE_BUILD_LOG_GROUP_NAME || '/metorial/forge/codebuild';

  let projectParams: CreateProjectCommandInput = {
    name: ProjectName,
    serviceRole: serviceRoleArn,
    source: {
      type: 'NO_SOURCE',
      buildspec: `
version: 0.2
phases:
  build:
    commands:
      - echo "METORIAL FORGE DEFAULT BUILD SPEC - Do not directly run this project, it is managed by the Forge service"
`
    },
    artifacts: { type: 'NO_ARTIFACTS' },
    environment: {
      type: 'LINUX_CONTAINER',
      image: 'aws/codebuild/standard:7.0',
      computeType: 'BUILD_GENERAL1_SMALL'
    },
    logsConfig: {
      cloudWatchLogs: {
        status: 'ENABLED',
        groupName: logGroupName,
        streamName: 'forge-build-logs'
      }
    },
    concurrentBuildLimit: env.codeBuild.CODE_BUILD_CONCURRENCY_LIMIT ?? 5
  };

  await logsClient.send(
    new PutRetentionPolicyCommand({
      logGroupName,
      retentionInDays: env.codeBuild.CODE_BUILD_LOG_RETENTION_DAYS ?? 3
    })
  );

  if (!exists) {
    await codebuild.send(new CreateProjectCommand(projectParams));
    return { created: true, projectName: ProjectName };
  }

  await codebuild.send(new UpdateProjectCommand(projectParams));
  return { created: false, projectName: ProjectName };
});
