import { getSentry } from '@lowerdeck/sentry';
import type { InvokeOutput } from '@metorial-platform-systems/cluster-manager-client';
import { env } from '../../env';
import { decryptFunctionVersionEnvironmentVariables } from '../../lib/decryptFunctionVersionEnvironmentVariables';
import { mintInvocationGrant, mintInvocationToken } from '../../lib/invocationCredentials';
import type { FunctionInvocationResult } from '../../lib/presentInvokeResponse';
import { parseInvocationPayload, type FunctionInvocationParams } from '../_lib';
import { getClusterManager, getClusterManagerErrorCode } from './clusterManager';
import { ensureKnativeFunction, type KnativeProviderData } from './spec';

let Sentry = getSentry();

let MAX_PAYLOAD_BYTES = 6 * 1024 * 1024;
let INVOKE_TIMEOUT_MARGIN_MS = 10_000;

let platformErrors: Record<string, { code: string; message: string }> = {
  function_unavailable: {
    code: 'function_bay.function_unavailable',
    message: 'The function did not become ready in time'
  },
  cluster_capacity: {
    code: 'function_bay.capacity',
    message: 'There is no capacity to run the function right now'
  }
};

let invocationError = (
  error: { code: string; message: string },
  internalError?: string
): FunctionInvocationResult => ({
  type: 'error',
  error,
  internalError,
  logs: [],
  computeTimeMs: -1,
  billedTimeMs: -1
});

export let invokeFunction = async (
  d: FunctionInvocationParams
): Promise<FunctionInvocationResult> => {
  let providerData = d.providerData as KnativeProviderData;
  let configuration = d.functionVersion.configuration;
  let payloadJson = JSON.stringify(d.payload);

  if (Buffer.byteLength(payloadJson, 'utf8') > MAX_PAYLOAD_BYTES) {
    return invocationError({
      code: 'function_bay.payload_too_large',
      message: `The invocation payload exceeds the ${MAX_PAYLOAD_BYTES} byte limit`
    });
  }

  let deadlineMs =
    (configuration.timeoutSeconds + env.clusterManager.KNATIVE_BOOT_ALLOWANCE_SECONDS) * 1000;

  let invoke = async () =>
    await getClusterManager().function.invoke(
      {
        versionId: d.functionVersion.id,
        payloadJson,
        invocationToken: mintInvocationToken({
          invocationId: d.invocationId,
          functionVersionId: d.functionVersion.id,
          payloadJson,
          timeoutSeconds: configuration.timeoutSeconds
        }),
        egressGrant: mintInvocationGrant({
          invocationId: d.invocationId,
          tenantId: d.tenantId,
          function: d.function,
          sourceFunction: d.sourceFunction,
          functionVersion: d.functionVersion,
          enclave: d.enclave,
          egressPolicy: d.egressPolicy,
          source: 'knative'
        }),
        deadlineMs
      },
      { timeoutMs: deadlineMs + INVOKE_TIMEOUT_MARGIN_MS }
    );

  let res: InvokeOutput;

  try {
    try {
      res = await invoke();
    } catch (err) {
      if (getClusterManagerErrorCode(err) !== 'function_not_materialized') throw err;

      await ensureKnativeFunction({
        mode: 'on-demand',
        functionVersion: d.functionVersion,
        function: d.function,
        configuration,
        providerData,
        env: await decryptFunctionVersionEnvironmentVariables({
          functionVersion: d.functionVersion,
          encryptedEnvironmentVariables: providerData.encryptedEnvironmentVariables
        }),
        timeoutMs: deadlineMs + INVOKE_TIMEOUT_MARGIN_MS
      });

      res = await invoke();
    }
  } catch (err) {
    let code = getClusterManagerErrorCode(err);
    let platformError = code ? platformErrors[code] : undefined;

    if (!platformError) {
      Sentry.captureException(err, {
        extra: {
          error: String(err),
          functionVersionId: d.functionVersion.id,
          functionId: d.function.id
        }
      });

      console.warn('Failed to invoke knative function', {
        error: String(err),
        functionVersionId: d.functionVersion.id,
        functionId: d.function.id
      });
    }

    return invocationError(
      platformError ?? {
        code: 'function_bay.provider_error',
        message: 'Unable to invoke function'
      },
      String(err)
    );
  }

  return parseInvocationPayload({
    payload: res.payload as Record<string, any> | string | null,
    outputs: {
      logs: res.logs.map(log => [new Date(log.ts).getTime(), log.line]),
      computeTimeMs: res.computeTimeMs,
      billedTimeMs: res.computeTimeMs
    },
    hasBootError: res.bootError
  });
};
