import {
  Runtime as AwsRuntime,
  CreateFunctionCommand,
  GetFunctionCommand
} from '@aws-sdk/client-lambda';
import type { FunctionBayRuntimeConfig } from '@function-bay/types';
import { delay } from '@lowerdeck/delay';
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import JSZip from 'jszip';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Function, FunctionDeployment, Runtime } from '../../../prisma/generated/client';
import { lambdaNetworkConfig } from '../../env';
import { getDeflectorProxyUrl } from './deflector';
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

let nodeProxyWrapperBootstrap = `
const { bootstrap } = require('global-agent');
const { ProxyAgent, setGlobalDispatcher } = require('undici');

let bootstrapped = false;

exports.applyDeflector = function applyDeflector(event) {
  const deflector = event && event.__functionBay && event.__functionBay.deflector;
  if (!deflector || !deflector.proxyUrl || !deflector.token) return;

  const url = new URL(deflector.proxyUrl);
  url.username = deflector.token;
  url.password = 'x';

  const proxyUrlWithAuth = url.toString();
  const proxyAuthorization = 'Basic ' + Buffer.from(deflector.token + ':x').toString('base64');
  const noProxy = process.env.NO_PROXY || '169.254.169.254,169.254.170.2,localhost,127.0.0.1';

  // Avoid exposing the credentialed proxy URL through generic proxy env vars.
  // Some OAuth/HTTP libraries eagerly parse those values and reject long JWT
  // credentials as invalid URLs. global-agent still forces Node core http(s)
  // through the proxy, and Undici receives the auth header explicitly below.
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  delete process.env.http_proxy;
  delete process.env.https_proxy;
  delete process.env.grpc_proxy;
  delete process.env.GRPC_PROXY;
  process.env.NO_PROXY = noProxy;
  process.env.no_proxy = noProxy;
  process.env.GLOBAL_AGENT_HTTP_PROXY = proxyUrlWithAuth;
  process.env.GLOBAL_AGENT_HTTPS_PROXY = proxyUrlWithAuth;
  process.env.GLOBAL_AGENT_NO_PROXY = noProxy;

  if (!bootstrapped) {
    bootstrap();
    bootstrapped = true;
  } else if (globalThis.GLOBAL_AGENT) {
    globalThis.GLOBAL_AGENT.HTTP_PROXY = proxyUrlWithAuth;
    globalThis.GLOBAL_AGENT.HTTPS_PROXY = proxyUrlWithAuth;
    globalThis.GLOBAL_AGENT.NO_PROXY = noProxy;
  }

  setGlobalDispatcher(new ProxyAgent({
    uri: deflector.proxyUrl,
    token: proxyAuthorization
  }));
};
`;

let nodeProxyWrapper = (originalHandler: string, bootstrapCode: string) => `
${bootstrapCode}
const originalHandler = ${JSON.stringify(originalHandler)};
const [modulePath, exportName = 'handler'] = originalHandler.split(/\\.([^.]*)$/).filter(Boolean);
const path = require('path');
const { pathToFileURL } = require('url');
let loaded;

async function loadOriginalModule() {
  try {
    return require('./' + modulePath);
  } catch (err) {
    const candidates = [
      modulePath,
      /\\.[cm]?js$/.test(modulePath) ? undefined : modulePath + '.js',
      /\\.[cm]?js$/.test(modulePath) ? undefined : modulePath + '.mjs'
    ].filter(Boolean);

    let lastError = err;
    for (const candidate of candidates) {
      try {
        return await import(pathToFileURL(path.resolve(__dirname, candidate)).href);
      } catch (importErr) {
        lastError = importErr;
      }
    }
    throw lastError;
  }
}

exports.handler = async (event, context) => {
  exports.applyDeflector(event);
  if (!loaded) {
    loaded = await loadOriginalModule();
  }
  const handler = loaded[exportName];
  if (typeof handler !== 'function') throw new Error('Original handler export not found');
  return await handler(event, context);
};
`;

let nodeProxyWrapperBootstrapPromise: Promise<string> | undefined;

let getNodeProxyWrapperBootstrapCachePath = () =>
  join(
    tmpdir(),
    'function-bay-wrapper-build',
    `metorial-deflector-bootstrap-${process.version.replace(/[^a-zA-Z0-9.-]/g, '-')}.js`
  );

let bundleNodeProxyWrapperBootstrap = async () => {
  let bun = (globalThis as any).Bun;
  if (!bun?.build) {
    throw new Error('Bun.build is required to bundle the Function Bay Node proxy wrapper');
  }

  // Keep the build entrypoint under cwd so Bun resolves service dependencies correctly.
  let dir = join(process.cwd(), '.function-bay-wrapper-build');
  await mkdir(dir, { recursive: true });
  let entrypoint = join(
    dir,
    `metorial-deflector-bootstrap-entry-${Date.now()}-${Math.random().toString(36).slice(2)}.js`
  );

  try {
    await writeFile(entrypoint, nodeProxyWrapperBootstrap);
    let result = await bun.build({
      entrypoints: [entrypoint],
      target: 'node',
      format: 'cjs',
      minify: true
    });

    if (!result.success) {
      throw new Error('Failed to bundle the Function Bay Node proxy wrapper');
    }

    let output = result.outputs?.[0];
    if (!output) throw new Error('Bundled Function Bay Node proxy wrapper was empty');
    return await output.text();
  } finally {
    await rm(entrypoint, { force: true });
  }
};

let getNodeProxyWrapperBootstrap = async () => {
  if (!nodeProxyWrapperBootstrapPromise) {
    nodeProxyWrapperBootstrapPromise = (async () => {
      let cachePath = getNodeProxyWrapperBootstrapCachePath();
      try {
        let existing = await stat(cachePath);
        if (existing.isFile()) return await readFile(cachePath, 'utf8');
      } catch {}

      let bundled = await bundleNodeProxyWrapperBootstrap();
      await mkdir(join(tmpdir(), 'function-bay-wrapper-build'), { recursive: true });
      await writeFile(cachePath, bundled);
      return bundled;
    })();
  }

  return await nodeProxyWrapperBootstrapPromise;
};

let buildNodeProxyWrapper = async (originalHandler: string) =>
  nodeProxyWrapper(originalHandler, await getNodeProxyWrapperBootstrap());

let prepareZip = async (d: {
  zipFileUrl: string;
  runtimeConfig: FunctionBayRuntimeConfig;
}) => {
  let zipBytes = Buffer.from(await (await fetch(d.zipFileUrl)).arrayBuffer());

  if (d.runtimeConfig.runtime.identifier !== 'nodejs' || !getDeflectorProxyUrl()) {
    return {
      zipBytes,
      handler: d.runtimeConfig.handler
    };
  }

  let zip = await JSZip.loadAsync(zipBytes);
  zip.file('metorial_deflector_wrapper.cjs', await buildNodeProxyWrapper(d.runtimeConfig.handler));

  return {
    zipBytes: Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
    handler: 'metorial_deflector_wrapper.handler'
  };
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
  let zip = await prepareZip({
    zipFileUrl: d.zipFileUrl,
    runtimeConfig: d.runtimeConfig
  });

  let res = await lambdaClient.send(
    new CreateFunctionCommand({
      FunctionName: `mtrl-fbay-func-${d.functionVersion.id}`,
      Description: `Function Bay function ${d.function.id} version ${d.functionVersion.id}`,
      Role: role,
      Runtime: getRuntime(d.runtimeConfig),
      Handler: zip.handler,
      Code: {
        ZipFile: zip.zipBytes
      },
      Timeout: d.functionDeployment.configuration.timeoutSeconds,
      MemorySize: d.functionDeployment.configuration.memorySizeMb,
      VpcConfig: lambdaNetworkConfig
        ? {
            SubnetIds: lambdaNetworkConfig.subnetIds,
            SecurityGroupIds: lambdaNetworkConfig.securityGroupIds
          }
        : undefined,
      Environment: {
        Variables: {
          ...d.env,
          METORIAL_FUNCTION_ID: d.function.id,
          METORIAL_FUNCTION_VERSION_ID: d.functionVersion.id,
          METORIAL_EXECUTION_ENV: 'function-bay',
          METORIAL_RUNTIME: d.runtime.identifier,
          ...(getDeflectorProxyUrl() ? { DEFLECTOR_PROXY_URL: getDeflectorProxyUrl()! } : {})
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
