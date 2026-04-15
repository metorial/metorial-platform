import { InvokeCommand, type InvokeCommandOutput } from '@aws-sdk/client-lambda';
import { getSentry } from '@lowerdeck/sentry';
import type { Function, FunctionVersion } from '../../../prisma/generated/client';
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
    res = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: d.providerData.functionName,
        Payload: new TextEncoder().encode(
          JSON.stringify({
            payload: d.payload
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
    let body: { statusCode?: number; body?: { error?: Record<string, any>; result?: any } } =
      JSON.parse(new TextDecoder().decode(res.Payload));
    let statusCode = body.statusCode || res.StatusCode || 500;
    let result = body.body || {};

    if (statusCode == 200 && result.result) {
      return {
        type: 'success' as const,
        result: result.result,
        ...outputs
      };
    }

    if (result.error) {
      return {
        type: 'error' as const,
        error: {
          ...result.error,
          code: result.error.code || 'function_bay.function_error',
          message: result.error.message || 'Function invocation resulted in an error'
        },
        ...outputs
      };
    }

    let errorBody = body as any;
    if (errorBody?.errorType == 'Error' && typeof errorBody?.errorMessage == 'string') {
      let traceArr = errorBody?.trace && Array.isArray(errorBody.trace) ? errorBody.trace : [];
      let trace = traceArr.join('\n');

      return {
        type: 'error' as const,
        error: {
          code: 'function_bay.function_error',
          message: `Function invocation resulted in an error:\nError ${errorBody.errorMessage}\n\n${trace}`
        },
        ...outputs
      };
    }

    if (hasBootError) {
      return {
        type: 'error' as const,
        error: {
          code: 'function_bay.function_error',
          message:
            'Function threw an error during initialization. This is often due to the global/root scope throwing an error, or the code being malformed.'
        },
        ...outputs
      };
    }

    return {
      type: 'error' as const,
      error: {
        code: 'function_bay.invalid_response',
        message: 'Function returned an invalid response'
      },
      ...outputs
    };
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

    return {
      type: 'error' as const,
      error: {
        code: 'function_bay.invalid_response',
        message: 'Function returned an invalid response'
      },
      internalError: String(err),
      ...outputs
    };
  }
};
