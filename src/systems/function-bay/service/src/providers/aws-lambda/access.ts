import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  GetAccountSettingsCommand
} from '@aws-sdk/client-lambda';
import { delay } from '@lowerdeck/delay';
import JSZip from 'jszip';
import { env } from '../../env';
import { lambdaClient } from './lambda';
import { ensureLambdaExecutionRole } from './role';

let getHelloZipBytes = async () => {
  let zip = new JSZip();
  zip.file(
    'index.js',
    "exports.handler = async () => { return { statusCode: 200, body: 'ok' }; };\n"
  );
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
};

export let checkLambdaAccess = async () => {
  if (env.provider.DEFAULT_PROVIDER !== 'aws.lambda') return;
  if (!lambdaClient) throw new Error('Lambda client not initialized');

  let attempts = 0;
  let maxAttempts = 5;
  let lastError: unknown;

  while (attempts < maxAttempts) {
    attempts += 1;

    let functionName = `mtrl-fbay-accesscheck-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

    try {
      // Quick sanity check that creds/region are valid.
      await lambdaClient.send(new GetAccountSettingsCommand({}));

      let roleArn = await ensureLambdaExecutionRole();
      let zipBytes = await getHelloZipBytes();

      // PassRole errors are only surfaced when calling CreateFunction.
      await lambdaClient.send(
        new CreateFunctionCommand({
          FunctionName: functionName,
          Runtime: 'nodejs22.x',
          Handler: 'index.handler',
          Role: roleArn,
          Code: { ZipFile: zipBytes },
          Timeout: 3,
          MemorySize: 128
        })
      );

      await lambdaClient.send(new DeleteFunctionCommand({ FunctionName: functionName }));

      console.log('Successfully verified Lambda access');
      return;
    } catch (err) {
      lastError = err;

      // Best-effort cleanup if CreateFunction partially succeeded.
      try {
        await lambdaClient.send(new DeleteFunctionCommand({ FunctionName: functionName }));
      } catch {}

      await delay(2000 * attempts);
    }
  }

  throw new Error(
    `Lambda access check failed after ${maxAttempts} attempts: ${
      (lastError as Error)?.message ?? String(lastError)
    }`
  );
};
