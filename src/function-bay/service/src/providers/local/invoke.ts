import { getSentry } from '@lowerdeck/sentry';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import JSZip from 'jszip';
import { tmpdir } from 'os';
import { dirname, join, resolve, sep } from 'path';
import { env } from '../../env';
import { decryptFunctionVersionEnvironmentVariables } from '../../lib/decryptFunctionVersionEnvironmentVariables';
import { storage } from '../../storage';
import type { FunctionInvocationParams } from '../_lib';
import { parseInvocationPayload } from '../_lib';

let Sentry = getSentry();

let RUNNER_FILE_NAME = '__metorial_local_runner__.cjs';

let LOCAL_RUNNER_SCRIPT = `'use strict';
const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');

let getErrorPayload = err => ({
  errorType: err && typeof err.name === 'string' ? err.name : 'Error',
  errorMessage: err && typeof err.message === 'string' ? err.message : String(err),
  trace: typeof err?.stack === 'string' ? err.stack.split('\\n') : []
});

let resolveHandlerParts = handler => {
  let lastSeparator = handler.lastIndexOf('.');
  if (lastSeparator === -1) {
    return { modulePath: handler, exportName: 'handler' };
  }

  return {
    modulePath: handler.slice(0, lastSeparator),
    exportName: handler.slice(lastSeparator + 1) || 'handler'
  };
};

let resolveCandidatePaths = handlerPath => {
  let candidates = [handlerPath];
  if (!path.extname(handlerPath)) {
    candidates.push(handlerPath + '.js', handlerPath + '.cjs', handlerPath + '.mjs');
  }

  return candidates;
};

let loadModule = async handlerPath => {
  for (let candidatePath of resolveCandidatePaths(handlerPath)) {
    try {
      return require(candidatePath);
    } catch (err) {
      if (err && err.code === 'ERR_REQUIRE_ESM') {
        return await import(pathToFileURL(candidatePath).href);
      }

      if (err && err.code === 'MODULE_NOT_FOUND') {
        continue;
      }

      throw err;
    }
  }

  throw new Error('Unable to locate handler module at ' + handlerPath);
};

let resolveHandler = (loadedModule, exportName) => {
  if (typeof loadedModule?.[exportName] === 'function') return loadedModule[exportName];
  if (exportName === 'handler' && typeof loadedModule === 'function') return loadedModule;
  if (typeof loadedModule?.default?.[exportName] === 'function') {
    return loadedModule.default[exportName];
  }
  if (exportName === 'handler' && typeof loadedModule?.default === 'function') {
    return loadedModule.default;
  }

  return null;
};

let main = async () => {
  let config = JSON.parse(process.env.METORIAL_LOCAL_RUNNER_CONFIG || '{}');
  let { modulePath, exportName } = resolveHandlerParts(config.handler);
  let handlerPath = path.resolve(config.bundleDirectory, modulePath);
  let event = JSON.parse(await fs.readFile(config.eventPath, 'utf-8'));

  try {
    let loadedModule = await loadModule(handlerPath);
    let handler = resolveHandler(loadedModule, exportName);
    if (typeof handler !== 'function') {
      throw new Error('Handler export "' + exportName + '" was not found');
    }

    let result = await handler(event);
    await fs.writeFile(config.resultPath, JSON.stringify(result), 'utf-8');
  } catch (err) {
    await fs.writeFile(config.resultPath, JSON.stringify(getErrorPayload(err)), 'utf-8');
  }
};

main().catch(async err => {
  let config = JSON.parse(process.env.METORIAL_LOCAL_RUNNER_CONFIG || '{}');
  if (config.resultPath) {
    await fs.writeFile(config.resultPath, JSON.stringify(getErrorPayload(err)), 'utf-8');
  }
  process.exit(0);
});
`;

let ensureLocalProviderEnabled = () => {
  if (env.provider.DEFAULT_PROVIDER !== 'local') {
    throw new Error('Local Function Bay provider is disabled');
  }
};

let isMissingObjectError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'statusCode' in error &&
  error.statusCode === 404;

let loadFunctionBundle = async (d: FunctionInvocationParams) => {
  try {
    return await storage.getObject(d.providerData.bucket, d.providerData.storageKey);
  } catch (error) {
    let fallback = d.functionBundle;
    let fallbackBucket = fallback?.bucket;
    let fallbackStorageKey = fallback?.storageKey;
    if (
      !isMissingObjectError(error) ||
      !fallbackBucket ||
      !fallbackStorageKey ||
      (fallbackBucket === d.providerData.bucket &&
        fallbackStorageKey === d.providerData.storageKey)
    ) {
      throw error;
    }

    return await storage.getObject(fallbackBucket, fallbackStorageKey);
  }
};

let ensurePathWithin = (basePath: string, targetPath: string) => {
  let resolvedBasePath = resolve(basePath);
  let resolvedTargetPath = resolve(basePath, targetPath);

  if (
    resolvedTargetPath !== resolvedBasePath &&
    !resolvedTargetPath.startsWith(resolvedBasePath + sep)
  ) {
    throw new Error(`Path escapes local function workspace: ${targetPath}`);
  }

  return resolvedTargetPath;
};

let extractZipToDirectory = async (data: Buffer, targetDirectory: string) => {
  let zip = await JSZip.loadAsync(data);

  for (let file of Object.values(zip.files)) {
    let outputPath = ensurePathWithin(targetDirectory, file.name);

    if (file.dir) {
      await fs.mkdir(outputPath, { recursive: true });
      continue;
    }

    await fs.mkdir(dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, await file.async('nodebuffer'));
  }
};

let captureProcessLogs = async (d: {
  command: string;
  args: string[];
  cwd: string;
  envVars: Record<string, string>;
  logs: [number, string][];
}) => {
  return await new Promise<number>((resolvePromise, rejectPromise) => {
    let child = spawn(d.command, d.args, {
      cwd: d.cwd,
      env: {
        ...process.env,
        ...d.envVars
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let attachStream = (stream?: NodeJS.ReadableStream | null) => {
      if (!stream) return;

      let buffer = '';
      stream.setEncoding?.('utf-8');
      stream.on('data', (chunk: string) => {
        buffer += chunk;

        while (true) {
          let lineBreakIndex = buffer.search(/\r?\n/);
          if (lineBreakIndex === -1) break;

          let rawLine = buffer.slice(0, lineBreakIndex);
          let consumedLength = buffer[lineBreakIndex] === '\r' ? 2 : 1;
          buffer = buffer.slice(lineBreakIndex + consumedLength);

          if (rawLine.trim()) {
            d.logs.push([Date.now(), rawLine]);
          }
        }
      });

      stream.on('end', () => {
        if (buffer.trim()) {
          d.logs.push([Date.now(), buffer]);
        }
      });
    };

    attachStream(child.stdout);
    attachStream(child.stderr);

    child.on('error', rejectPromise);
    child.on('close', code => resolvePromise(code ?? 0));
  });
};

export let invokeFunction = async (d: FunctionInvocationParams) => {
  ensureLocalProviderEnabled();

  let outputs = {
    logs: [] as [number, string][],
    computeTimeMs: -1,
    billedTimeMs: -1
  };
  let startedAt = Date.now();
  let tempDirectory = await fs.mkdtemp(join(tmpdir(), 'metorial-function-bay-local-'));
  let bundleDirectory = join(tempDirectory, 'bundle');
  let runnerPath = join(tempDirectory, RUNNER_FILE_NAME);
  let eventPath = join(tempDirectory, 'event.json');
  let resultPath = join(tempDirectory, 'result.json');

  try {
    let bundle = await loadFunctionBundle(d);
    await fs.mkdir(bundleDirectory, { recursive: true });
    await extractZipToDirectory(bundle.data, bundleDirectory);
    await fs.writeFile(runnerPath, LOCAL_RUNNER_SCRIPT, 'utf-8');
    await fs.writeFile(eventPath, JSON.stringify({ payload: d.payload }), 'utf-8');

    let envVars = await decryptFunctionVersionEnvironmentVariables({
      functionVersion: d.functionVersion,
      encryptedEnvironmentVariables: d.providerData.encryptedEnvironmentVariables
    });

    let exitCode = await captureProcessLogs({
      command: process.execPath,
      args: [runnerPath],
      cwd: tempDirectory,
      envVars: {
        ...envVars,
        METORIAL_FUNCTION_ID: d.function.id,
        METORIAL_FUNCTION_VERSION_ID: d.functionVersion.id,
        METORIAL_EXECUTION_ENV: 'function-bay',
        METORIAL_RUNTIME: d.providerData.runtimeIdentifier,
        METORIAL_LOCAL_RUNNER_CONFIG: JSON.stringify({
          bundleDirectory,
          handler: d.providerData.handler,
          eventPath,
          resultPath
        })
      },
      logs: outputs.logs
    });

    outputs.computeTimeMs = Date.now() - startedAt;
    outputs.billedTimeMs = outputs.computeTimeMs;

    let payload = null;
    try {
      payload = JSON.parse(await fs.readFile(resultPath, 'utf-8'));
    } catch {}

    return parseInvocationPayload({
      payload,
      outputs,
      hasBootError: !payload,
      internalError: exitCode === 0 ? undefined : `Local runtime exited with code ${exitCode}`
    });
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        error: String(err),
        functionVersionId: d.functionVersion.id,
        functionId: d.function.id
      }
    });

    console.warn('Failed to invoke local function', {
      error: String(err),
      functionVersionId: d.functionVersion.id,
      functionId: d.function.id
    });

    outputs.computeTimeMs = Date.now() - startedAt;
    outputs.billedTimeMs = outputs.computeTimeMs;

    return {
      type: 'error' as const,
      error: {
        code: 'function_bay.provider_error',
        message: 'Unable to invoke function'
      },
      internalError: String(err),
      ...outputs
    };
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
};
