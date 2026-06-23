import {
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
  UpdateAssumeRolePolicyCommand
} from '@aws-sdk/client-iam';
import { once } from '@lowerdeck/once';
import { env } from '../../env';

let iam =
  env.provider.DEFAULT_PROVIDER == 'aws.code-build'
    ? new IAMClient({
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

let RoleName = 'metorial-forge-codebuild-role-v1';

let trustPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'codebuild.amazonaws.com' },
      Action: 'sts:AssumeRole'
    }
  ]
};

let permissionsPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      Resource: '*'
    }
  ]
};

export let ensureCodeBuildRole = once(async () => {
  if (env.codeBuild.CODE_BUILD_ROLE_ARN) return env.codeBuild.CODE_BUILD_ROLE_ARN;

  if (!iam) throw new Error('IAM client not initialized');

  let roleArn: string;

  try {
    let resp = await iam.send(new GetRoleCommand({ RoleName }));
    roleArn = resp.Role!.Arn!;
  } catch (err: any) {
    if (err.name !== 'NoSuchEntityException') throw err;

    try {
      let createResp = await iam.send(
        new CreateRoleCommand({
          RoleName,
          AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
          Description: 'METORIAL AUTO-GENERATED: Role for CodeBuild projects (Forge service)'
        })
      );

      roleArn = createResp.Role!.Arn!;
    } catch (createErr: any) {
      if (createErr.name !== 'EntityAlreadyExistsException') throw createErr;

      let getResp = await iam.send(new GetRoleCommand({ RoleName }));
      roleArn = getResp.Role!.Arn!;
    }
  }

  await iam.send(
    new UpdateAssumeRolePolicyCommand({
      RoleName,
      PolicyDocument: JSON.stringify(trustPolicy)
    })
  );

  await iam.send(
    new PutRolePolicyCommand({
      RoleName,
      PolicyName: 'codebuild-basic-logs',
      PolicyDocument: JSON.stringify(permissionsPolicy)
    })
  );

  return roleArn;
});
