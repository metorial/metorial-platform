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
  env.provider.DEFAULT_PROVIDER == 'aws.lambda'
    ? new IAMClient({
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

let RoleName = 'metorial-function-bay-lambda-execution-role-v1';

let trustPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'lambda.amazonaws.com' },
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

export let ensureLambdaExecutionRole = once(async () => {
  if (env.lambda.LAMBDA_EXECUTION_ROLE_ARN) return env.lambda.LAMBDA_EXECUTION_ROLE_ARN;

  if (!iam) throw new Error('IAM client not initialized');

  let roleArn: string;
  let roleWasJustCreated = false;

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
          Description:
            'METORIAL AUTO-GENERATED: Execution role for Lambda functions (Forge service)'
        })
      );

      roleArn = createResp.Role!.Arn!;
      roleWasJustCreated = true;
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
      PolicyName: 'lambda-basic-logs',
      PolicyDocument: JSON.stringify(permissionsPolicy)
    })
  );

  // Wait for IAM role to propagate if it was just created
  if (roleWasJustCreated) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
  }

  return roleArn;
});
