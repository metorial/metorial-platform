import { InvokeCommand, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { getSentry } from '@lowerdeck/sentry';
import type { Function, FunctionVersion } from '../../../prisma/generated/client';
import { parseInvocationPayload } from '../_lib';
import { createDeflectorToken, getDeflectorProxyUrl } from './deflector';
import { lambdaClient } from './lambda';

let Sentry = getSentry();

let reportMapper = {
  RequestId: 'requestId',
  Duration: 'durationMs',
  'Billed Duration': 'billedDurationMs',
  'Memory Size': 'memorySizeMb',
  'Max Memory Used': 'maxMemoryUsedMb'
};

let parseReport = (report: string) => {
  let parts = report.substring(7).split('\t');

  let result: Record<string, string | number> = {};
  for (let part of parts) {
    let [key, value] = part.split(': ').map(s => s.trim());
    if (!key || !value) continue;

    let mappedKey = reportMapper[key as keyof typeof reportMapper] || key;

    if (value.endsWith('ms')) {
      result[mappedKey] = Number(value.replace('ms', ''));
    } else if (value.endsWith('MB')) {
      result[mappedKey] = Number(value.replace('MB', ''));
    } else {
      result[mappedKey] = value;
    }
  }

  return result;
};

export let invokeFunction = async (d: {
  functionVersion: FunctionVersion;
  function: Function;
  payload: Record<string, any>;
  egressPolicy?: {
    allowedIps?: string[];
    allowedHosts?: string[];
  };
  providerData: {
    functionArn: string;
    functionName: string;
  };
}) => {
  if (!lambdaClient) throw new Error('Lambda client not initialized');

  let res: InvokeCommandOutput;

  let outputs = {
    logs: [] as [number, string][],
    computeTimeMs: -1,
    billedTimeMs: -1
  };

  let startTs = Date.now();

  try {
    let deflectorToken = await createDeflectorToken({
      functionId: d.function.id,
      functionVersionId: d.functionVersion.id,
      egressPolicy: d.egressPolicy
    });

    res = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: d.providerData.functionName,
        Payload: new TextEncoder().encode(
          JSON.stringify({
            payload: d.payload,
            __functionBay: deflectorToken
              ? {
                  deflector: {
                    proxyUrl: getDeflectorProxyUrl(),
                    token: deflectorToken
                  }
                }
              : undefined
          })
        ),
        LogType: 'Tail'
      })
    );
  } catch (err) {
    return {
      type: 'error' as const,
      error: {
        code: 'function_bay.provider_error',
        message: 'Unable to invoke function'
      },
      internalError: String(err),
      ...outputs
    };
  }

  let hasBootError = false;

  try {
    let logs = res.LogResult ? atob(res.LogResult) : '';

    let lines = logs.split('\n');

    let startLine = 0;
    while (startLine < lines.length) {
      if (lines[startLine]?.includes('START RequestId')) break;
      if (lines[startLine]?.includes('END RequestId')) break;
      if (lines[startLine]?.includes('ERROR')) {
        hasBootError = true;
        startLine--;
        break;
      }

      startLine++;
    }

    let endLine = lines.length - 1;
    while (endLine >= 0 && !lines[endLine]?.includes('END RequestId')) {
      endLine--;
    }

    let productiveLogs = lines.slice(startLine + 1, endLine);
    let report = parseReport(lines[endLine + 1] ?? '');
    let requestId = report.requestId as string;

    let finalLogs: [number, string][] = [];

    if (requestId) {
      let currentTimestamp = startTs;
      for (let i = 0; i < productiveLogs.length; i++) {
        let line = productiveLogs[i];
        if (!line) continue;

        if (line.includes(requestId)) {
          let [ts, rest] = line.split(requestId);
          if (!ts || !rest) continue;

          currentTimestamp = new Date(ts.trim()).getTime();
          line = rest.trim().replace('ERROR\t', '').replace('INFO\t', '');
        }

        finalLogs.push([currentTimestamp, line]);
      }
    }

    outputs = {
      logs: finalLogs,
      computeTimeMs: report.durationMs as number,
      billedTimeMs: report.billedDurationMs as number
    };
  } catch (err) {
    Sentry.captureException(err);
  }

  try {
    return parseInvocationPayload({
      payload: res.Payload,
      outputs,
      hasBootError
    });
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        lambdaResponse: res,
        functionVersionId: d.functionVersion.id,
        functionId: d.function.id
      }
    });

    if (res.FunctionError) {
      return {
        type: 'error' as const,
        error: {
          code: 'function_bay.function_error',
          message: 'Function invocation resulted in an error'
        },
        internalError: `Function error: ${res.FunctionError}`,
        ...outputs
      };
    }

    return parseInvocationPayload({
      payload: res.Payload,
      outputs,
      hasBootError,
      internalError: String(err)
    });
  }
};
