import {
  CreateFunctionCommand,
  GetFunctionCommand,
  Runtime,
  State
} from '@aws-sdk/client-lambda';
import { delay } from '@metorial/delay';
import { awsLambda } from './aws';
import { ensureRole } from './ensureRole';

interface DeployLambdaOptions {
  functionName: string;
  s3Bucket: string;
  s3Key: string;
  roleArn: string;
  handler: string;
  runtime: Runtime;
  timeout?: number;
  memorySize: number;
  environment?: Record<string, string>;
}

export let deployLambda = async ({
  functionName,
  s3Bucket,
  s3Key,
  roleArn,
  handler,
  runtime,
  timeout = 30,
  memorySize,
  environment = {}
}: DeployLambdaOptions) => {
  let createResponse = await awsLambda.send(
    new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: runtime,
      Role: roleArn,
      Handler: handler,
      Code: {
        S3Bucket: s3Bucket,
        S3Key: s3Key
      },
      Timeout: timeout,
      MemorySize: memorySize,
      Environment: {
        Variables: environment
      },
      Architectures: ['x86_64'],
      PackageType: 'Zip'
    })
  );

  let state: State = 'Pending';

  while (true) {
    await delay(2000);

    try {
      let status = await awsLambda.send(
        new GetFunctionCommand({ FunctionName: functionName })
      );
      state = status?.Configuration?.State!;

      if (state === 'Active') {
        return {
          functionArn: status.Configuration?.FunctionArn,
          functionName: status.Configuration?.FunctionName,
          state,
          created: true
        };
      }

      if (state === 'Failed') {
        throw new Error('Lambda deployment failed');
      }
    } catch (err: any) {
      throw new Error(`Error checking Lambda status: ${err.message}`);
    }
  }
};

export let ensureLambdaExecutionRole = async (roleName: string) => {
  return await ensureRole(
    roleName,
    {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole'
        }
      ]
    },
    ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
  );
};
