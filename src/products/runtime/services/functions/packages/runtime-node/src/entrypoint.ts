import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Entrypoint {
  path: string;
  export?: string;
  kind: 'module' | 'enveloped';
}

export interface Envelope {
  statusCode: number;
  body: { result?: unknown; error?: unknown };
}

let launcherError = (statusCode: number, message: string): Envelope => ({
  statusCode,
  body: { error: { code: 'function_bay.launcher', message } }
});

let dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<any>;

export let loadModule = async (file: string) => {
  try {
    return createRequire(file)(file);
  } catch (err: any) {
    if (err?.code != 'ERR_REQUIRE_ESM' && err?.code != 'ERR_REQUIRE_ASYNC_MODULE') throw err;
    return await dynamicImport(pathToFileURL(file).href);
  }
};

export let loadEntrypoint = (bundleDir: string, entrypoint: Entrypoint) =>
  loadModule(path.resolve(bundleDir, entrypoint.path));

export let resolveHandler = (handlerModule: any, exportName?: string) => {
  if (
    exportName &&
    exportName != 'default' &&
    exportName != 'handler' &&
    typeof handlerModule?.[exportName] == 'function'
  ) {
    return handlerModule[exportName];
  }

  let handlerFunc = handlerModule;
  if (typeof handlerFunc == 'object') {
    if (typeof handlerFunc.default === 'function') {
      handlerFunc = handlerFunc.default;
    } else if (typeof handlerFunc.handler === 'function') {
      handlerFunc = handlerFunc.handler;
    }
  }
  return handlerFunc;
};

let formatError = (err: any) => {
  let fullMessage = '';
  if (typeof err == 'object' && err !== null) {
    if ('name' in err && typeof err.name === 'string') {
      fullMessage += `[${err.name}]: \n`;
    }
    if ('message' in err && typeof err.message === 'string') {
      fullMessage += err.message;
    }
    if ('stack' in err && typeof err.stack === 'string') {
      fullMessage += '\n' + err.stack;
    }
  } else {
    try {
      fullMessage = JSON.stringify(err);
    } catch {
      fullMessage = String(err || 'Unknown error');
    }
  }
  return fullMessage;
};

// Mirrors the Lambda launcher in @function-bay/nodejs byte for byte in its outcomes; the
// conformance suite runs both against the same fixtures. Errors the launcher itself would
// throw (e.g. a thrown null) propagate, as they did into the Lambda runtime.
export let runHandler = async (
  handlerFunc: unknown,
  rawPayload: unknown
): Promise<Envelope> => {
  if (typeof handlerFunc !== 'function') {
    return {
      statusCode: 500,
      body: {
        error: {
          code: 'function_bay.launcher',
          message: 'Entrypoint does not export a valid handler function'
        }
      }
    };
  }

  if (!rawPayload) return launcherError(400, 'Missing payload field');

  let data = rawPayload;
  if (typeof rawPayload === 'string') {
    try {
      data = JSON.parse(rawPayload);
    } catch {
      return launcherError(400, 'Invalid JSON payload');
    }
  }

  try {
    let result = await handlerFunc(data);
    return { statusCode: 200, body: { result } };
  } catch (err: any) {
    if (typeof err == 'object' && err.__function_bay_error) {
      return { statusCode: 500, body: { error: err.toResponse() } };
    }

    console.error(err);
    return {
      statusCode: 500,
      body: { error: { code: 'function_bay.handler_error', message: formatError(err) } }
    };
  }
};

// The error shape the Lambda runtime returned when the launcher itself failed, which
// parseInvocationPayload understands.
export let runtimeError = (err: any) => {
  if (err instanceof Error) {
    return {
      errorType: err.name || 'Error',
      errorMessage: err.message,
      trace: typeof err.stack == 'string' ? err.stack.split('\n') : []
    };
  }
  return { errorType: typeof err, errorMessage: String(err), trace: [] as string[] };
};

export let parsePayloadJson = (
  payloadJson: string
): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(payloadJson) };
  } catch {
    return { ok: false };
  }
};

export let createInvoker = (handlerModule: any, entrypoint: Entrypoint) => {
  if (entrypoint.kind == 'enveloped') {
    return async (payloadJson: string): Promise<unknown> => {
      let parsed = parsePayloadJson(payloadJson);
      try {
        return await handlerModule.handler({
          payload: parsed.ok ? parsed.value : payloadJson
        });
      } catch (err) {
        return runtimeError(err);
      }
    };
  }

  let handlerFunc = resolveHandler(handlerModule, entrypoint.export);
  return async (payloadJson: string): Promise<unknown> => {
    let parsed = parsePayloadJson(payloadJson);
    if (!parsed.ok) return launcherError(400, 'Invalid JSON payload');
    try {
      return await runHandler(handlerFunc, parsed.value);
    } catch (err) {
      return runtimeError(err);
    }
  };
};

export let serializeResult = (result: unknown) => {
  try {
    let json = JSON.stringify(result);
    if (json !== undefined) return json;
  } catch (err) {
    return JSON.stringify({
      errorType: 'Runtime.MalformedHandlerResponse',
      errorMessage: `Unable to serialize the handler response: ${(err as Error)?.message ?? err}`,
      trace: []
    });
  }
  return 'null';
};
