import {
  Runtime as AwsRuntime,
  CreateFunctionCommand,
  GetFunctionCommand
} from '@aws-sdk/client-lambda';
import type { FunctionBayRuntimeConfig } from '@function-bay/types';
import { delay } from '@lowerdeck/delay';
import type { Function, FunctionDeployment, Runtime } from '../../../prisma/generated/client';
import { lambdaClient } from './lambda';
import { ensureLambdaExecutionRole } from './role';

let getRuntime = (runtime: FunctionBayRuntimeConfig): AwsRuntime => {
  switch (runtime.runtime.identifier) {
    case 'nodejs':
      switch (runtime.runtime.version) {
        case '24.x':
          return 'nodejs24.x';
        case '22.x':
          return 'nodejs22.x';
      }
    case 'python':
      switch (runtime.runtime.version) {
        case '3.14':
          return 'python3.14';
        case '3.13':
          return 'python3.13';
        case '3.12':
          return 'python3.12';
      }
    case 'ruby':
      switch (runtime.runtime.version) {
        case '3.4':
          return 'ruby3.4';
        case '3.3':
          return 'ruby3.3';
      }
    case 'java':
      switch (runtime.runtime.version) {
        case '25':
          return 'java25';
        case '21':
          return 'java21';
      }
  }

  throw new Error('Unsupported runtime');
};

export let deployFunction = async (d: {
  functionVersion: { id: string };
  function: Function;
  functionDeployment: FunctionDeployment;
  runtimeConfig: FunctionBayRuntimeConfig;
  runtime: Runtime;
  env: Record<string, string>;
  zipFileUrl: string;
}) => {
  if (!lambdaClient) throw new Error('Lambda client not initialized');

  let role = await ensureLambdaExecutionRole();

  let res = await lambdaClient.send(
    new CreateFunctionCommand({
      FunctionName: `mtrl-fbay-func-${d.functionVersion.id}`,
      Description: `Function Bay function ${d.function.id} version ${d.functionVersion.id}`,
      Role: role,
      Runtime: getRuntime(d.runtimeConfig),
      Handler: d.runtimeConfig.handler,
      Code: {
        ZipFile: Buffer.from(await (await fetch(d.zipFileUrl)).arrayBuffer())
      },
      Timeout: d.functionDeployment.configuration.timeoutSeconds,
      MemorySize: d.functionDeployment.configuration.memorySizeMb,
      Environment: {
        Variables: {
          ...d.env,
          METORIAL_FUNCTION_ID: d.function.id,
          METORIAL_FUNCTION_VERSION_ID: d.functionVersion.id,
          METORIAL_EXECUTION_ENV: 'function-bay',
          METORIAL_RUNTIME: d.runtime.identifier
        }
      }
    })
  );

  if (!res.FunctionArn || !res.FunctionName) {
    throw new Error('Failed to deploy function');
  }

  await delay(2500);

  let func = await lambdaClient.send(
    new GetFunctionCommand({
      FunctionName: res.FunctionName
    })
  );

  while (func.Configuration?.State == 'Pending') {
    await delay(1000);

    func = await lambdaClient.send(
      new GetFunctionCommand({
        FunctionName: res.FunctionName
      })
    );
  }

  if (func.Configuration?.State == 'Failed') {
    throw new Error('Function deployment failed: ' + func.Configuration.StateReason);
  }

  return {
    providerData: {
      functionArn: res.FunctionArn!,
      functionName: res.FunctionName!
    }
  };
};
