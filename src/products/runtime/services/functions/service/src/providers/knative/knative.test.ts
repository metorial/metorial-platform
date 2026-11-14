import { createError, ServiceError } from '@lowerdeck/error';
import { importJWK, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  clusterManager: {
    bundle: { import: vi.fn() },
    function: { ensure: vi.fn(), invoke: vi.fn(), delete: vi.fn() }
  },
  createClusterManagerClient: vi.fn(),
  putObject: vi.fn(),
  decryptEnv: vi.fn(),
  findTenant: vi.fn(),
  fetch: vi.fn(),
  env: {
    storage: { BUNDLE_BUCKET_NAME: 'function-bay-bundles' },
    runtime: {
      RUNTIME_SIGNING_KEY: 'rVlw-_wVKiJ0kZPE9IHiWhxxzRC4eEEsi8jb0XD8M_Q',
      RUNTIME_SIGNING_KEY_ID: undefined
    },
    clusterManager: {
      CLUSTER_MANAGER_URL: 'http://cluster-manager.local',
      CLUSTER_MANAGER_TOKEN_FILE: '/var/run/cm-token',
      KNATIVE_BOOT_ALLOWANCE_SECONDS: 60
    }
  }
}));

vi.mock('@metorial-platform-systems/cluster-manager-client', () => ({
  createClusterManagerClient: mocks.createClusterManagerClient
}));
vi.mock('../../env', () => ({ env: mocks.env }));
vi.mock('../../db', () => ({ db: { tenant: { findUniqueOrThrow: mocks.findTenant } } }));
vi.mock('../../storage', () => ({ storage: { putObject: mocks.putObject } }));
vi.mock('../../encryption', () => ({
  encryption: {
    encrypt: async (d: { entityId: string; secret: string }) => `enc:${d.entityId}:${d.secret}`
  }
}));
vi.mock('../../lib/decryptFunctionVersionEnvironmentVariables', () => ({
  decryptFunctionVersionEnvironmentVariables: mocks.decryptEnv
}));

import { cloneFunctionVersion, deleteFunctionVersion, deployFunction } from './deploy';
import { invokeFunction } from './invoke';
import { entrypointFromHandler } from './spec';

let functionBayPublicKey = '7pxCkiayOQjmRbz8C9yTH2mQ-9lNPQ48PsT2qye7Dtg';

let verify = async (token: string, audience: string) =>
  (
    await jwtVerify(
      token,
      await importJWK({ kty: 'OKP', crv: 'Ed25519', x: functionBayPublicKey }, 'EdDSA'),
      { audience, issuer: 'function-bay' }
    )
  ).payload;

let clusterManagerError = (code: string, status = 409) =>
  new ServiceError(createError({ status, code, message: code }));

let bundle = {
  bucket: 'function-bay-bundles',
  key: 'bundles/functionVersion_1.tar.zst',
  sha256: 'a'.repeat(64),
  sizeBytes: 1234
};

let configuration: PrismaJson.FunctionConfiguration = {
  memorySizeMb: 512,
  timeoutSeconds: 30,
  concurrency: 'shared',
  sandbox: 'gvisor'
};

let func = { id: 'function_1', tenantOid: 7n } as any;

let providerData = {
  bundle,
  entrypoint: { path: 'index.js', export: 'handler', kind: 'module' as const },
  runtimeIdentifier: 'runtime_1',
  encryptedEnvironmentVariables: 'encrypted-env'
};

let invoke = (payload: Record<string, any> = { message: 'héllo' }) =>
  invokeFunction({
    invocationId: 'functionInvocation_1',
    tenantId: 'tenant_1',
    function: func,
    sourceFunction: func,
    functionVersion: { id: 'functionVersion_1', configuration } as any,
    payload,
    providerData
  });

let successOutput = {
  payload: { statusCode: 200, body: { result: { ok: true } } },
  logs: [
    { ts: new Date('2026-11-13T10:00:00.000Z'), stream: 'stdout', line: 'hello' },
    { ts: new Date('2026-11-13T10:00:01.000Z'), stream: 'stderr', line: 'warn' }
  ],
  logsTruncated: false,
  computeTimeMs: 42,
  bootError: false
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClusterManagerClient.mockReturnValue(mocks.clusterManager);
  mocks.findTenant.mockResolvedValue({ id: 'tenant_1' });
  mocks.clusterManager.bundle.import.mockResolvedValue(bundle);
  mocks.clusterManager.function.ensure.mockResolvedValue({
    state: 'materialized',
    name: 'fn'
  });
  mocks.clusterManager.function.invoke.mockResolvedValue(successOutput);
  mocks.decryptEnv.mockResolvedValue({ API_KEY: 'secret' });
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([80, 75, 3, 4])));
  vi.stubGlobal('fetch', mocks.fetch);
});

describe('entrypointFromHandler', () => {
  it('splits the handler at the last dot', () => {
    expect(entrypointFromHandler('index.handler', 'module')).toEqual({
      path: 'index.js',
      export: 'handler',
      kind: 'module'
    });
    expect(entrypointFromHandler('index.mjs.handler', 'module').path).toBe('index.mjs');
    expect(entrypointFromHandler('dist/server.main', 'enveloped')).toEqual({
      path: 'dist/server.js',
      export: 'main',
      kind: 'enveloped'
    });
  });
});

describe('knative deploy', () => {
  let deploy = (env: Record<string, string> = { API_KEY: 'secret' }) =>
    deployFunction({
      functionVersion: { id: 'functionVersion_1' },
      function: func,
      functionDeployment: { configuration } as any,
      runtimeConfig: { handler: 'index.handler' } as any,
      runtime: { identifier: 'runtime_1' } as any,
      env,
      zipFileUrl: 'https://artifacts.local/output.zip'
    });

  it('imports the bundle, stores provider data and materializes speculatively', async () => {
    let res = await deploy();

    expect(mocks.putObject).toHaveBeenCalledWith(
      'function-bay-bundles',
      'knative/sources/functionVersion_1.zip',
      expect.any(Buffer),
      'application/zip'
    );
    expect(mocks.clusterManager.bundle.import).toHaveBeenCalledWith({
      versionId: 'functionVersion_1',
      source: { bucket: 'function-bay-bundles', key: 'knative/sources/functionVersion_1.zip' }
    });
    expect(res.providerData).toEqual({
      bundle,
      entrypoint: { path: 'index.js', export: 'handler', kind: 'module' },
      runtimeIdentifier: 'runtime_1',
      encryptedEnvironmentVariables: 'enc:functionVersion_1:{"API_KEY":"secret"}'
    });
    expect(mocks.clusterManager.function.ensure).toHaveBeenCalledWith(
      {
        versionId: 'functionVersion_1',
        functionId: 'function_1',
        tenantId: 'tenant_1',
        mode: 'speculative',
        runtime: { identifier: 'nodejs', version: '24' },
        entrypoint: { path: 'index.js', export: 'handler', kind: 'module' },
        bundle,
        env: { API_KEY: 'secret' },
        memoryMb: 512,
        timeoutSeconds: 30,
        concurrency: 'shared',
        sandbox: 'gvisor'
      },
      undefined
    );
    expect(mocks.createClusterManagerClient).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://cluster-manager.local',
        tokenFile: '/var/run/cm-token'
      })
    );
  });

  it('tolerates a speculative ensure that runs out of capacity', async () => {
    mocks.clusterManager.function.ensure.mockRejectedValue(
      clusterManagerError('cluster_capacity', 503)
    );

    await expect(deploy()).resolves.toHaveProperty('providerData.bundle', bundle);
  });

  it('fails the deploy for an invalid bundle', async () => {
    mocks.clusterManager.bundle.import.mockRejectedValue(
      clusterManagerError('bundle_invalid', 400)
    );

    await expect(deploy()).rejects.toThrow('bundle_invalid');
  });

  it('rejects reserved environment variable names', async () => {
    await expect(deploy({ NODE_OPTIONS: '--inspect', METORIAL_X: '1' })).rejects.toMatchObject(
      {
        data: { code: 'invalid_data' }
      }
    );
    expect(mocks.clusterManager.bundle.import).not.toHaveBeenCalled();
  });
});

describe('knative clone and delete', () => {
  it('reuses the source bundle and re-encrypts the env for the clone', async () => {
    let res = await cloneFunctionVersion({
      functionVersion: { id: 'functionVersion_2' },
      sourceFunctionVersion: { providerData } as any,
      function: func,
      runtimeConfig: {} as any,
      runtime: { identifier: 'runtime_1' } as any,
      env: { API_KEY: 'secret', LD_PRELOAD: 'x' },
      zipFile: Buffer.alloc(0)
    });

    expect(res.providerData).toEqual({
      ...providerData,
      encryptedEnvironmentVariables: 'enc:functionVersion_2:{"API_KEY":"secret"}'
    });
    expect(mocks.clusterManager.bundle.import).not.toHaveBeenCalled();
  });

  it('deletes the materialized function', async () => {
    await deleteFunctionVersion({ functionVersion: { id: 'functionVersion_1' } as any });

    expect(mocks.clusterManager.function.delete).toHaveBeenCalledWith({
      versionId: 'functionVersion_1'
    });
  });
});

describe('knative invoke', () => {
  it('signs the exact payload and maps the result for parseInvocationPayload', async () => {
    let result = await invoke();

    expect(result).toEqual({
      type: 'success',
      result: { ok: true },
      logs: [
        [new Date('2026-11-13T10:00:00.000Z').getTime(), 'hello'],
        [new Date('2026-11-13T10:00:01.000Z').getTime(), 'warn']
      ],
      computeTimeMs: 42,
      billedTimeMs: 42
    });

    let [input, opts] = mocks.clusterManager.function.invoke.mock.calls[0]!;
    expect(input.versionId).toBe('functionVersion_1');
    expect(input.payloadJson).toBe('{"message":"héllo"}');
    expect(input.deadlineMs).toBe(90_000);
    expect(opts.timeoutMs).toBeGreaterThan(input.deadlineMs);

    let token = await verify(input.invocationToken, 'metorial-function-invoke');
    expect(token).toMatchObject({
      jti: 'functionInvocation_1',
      functionVersionId: 'functionVersion_1',
      payloadSha256: createHash('sha256').update(input.payloadJson, 'utf8').digest('hex')
    });

    let grant = await verify(input.egressGrant, 'metorial-egress');
    expect(grant).toMatchObject({
      jti: 'functionInvocation_1',
      source: 'knative',
      tenantId: 'tenant_1',
      functionId: 'function_1'
    });
    expect(mocks.clusterManager.function.ensure).not.toHaveBeenCalled();
  });

  it('materializes on demand and retries once with fresh tokens', async () => {
    mocks.clusterManager.function.invoke
      .mockRejectedValueOnce(clusterManagerError('function_not_materialized', 404))
      .mockResolvedValueOnce(successOutput);

    let result = await invoke();

    expect(result.type).toBe('success');
    expect(mocks.decryptEnv).toHaveBeenCalledWith(
      expect.objectContaining({ encryptedEnvironmentVariables: 'encrypted-env' })
    );
    expect(mocks.clusterManager.function.ensure).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'on-demand', env: { API_KEY: 'secret' } }),
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expect(mocks.clusterManager.function.invoke).toHaveBeenCalledTimes(2);

    let calls = mocks.clusterManager.function.invoke.mock.calls;
    let first = await verify(calls[0]![0].invocationToken, 'metorial-function-invoke');
    let second = await verify(calls[1]![0].invocationToken, 'metorial-function-invoke');
    expect(second.jti).toBe(first.jti);
  });

  it('does not retry a second time', async () => {
    mocks.clusterManager.function.invoke.mockRejectedValue(
      clusterManagerError('function_not_materialized', 404)
    );

    let result = await invoke();

    expect(mocks.clusterManager.function.invoke).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      type: 'error',
      error: { code: 'function_bay.provider_error' }
    });
  });

  it.each([
    ['function_unavailable', 'function_bay.function_unavailable'],
    ['cluster_capacity', 'function_bay.capacity'],
    ['invocation_unauthorized', 'function_bay.provider_error']
  ])('maps %s to %s', async (code, expected) => {
    mocks.clusterManager.function.invoke.mockRejectedValue(clusterManagerError(code, 503));

    let result = await invoke();

    expect(result).toMatchObject({ type: 'error', error: { code: expected } });
    expect(mocks.clusterManager.function.invoke).toHaveBeenCalledTimes(1);
  });

  it('passes function errors from the envelope through unchanged', async () => {
    mocks.clusterManager.function.invoke.mockResolvedValue({
      ...successOutput,
      payload: {
        statusCode: 504,
        body: {
          error: { code: 'function_bay.timeout', message: 'Function timed out after 30s' }
        }
      }
    });

    expect(await invoke()).toMatchObject({
      type: 'error',
      error: { code: 'function_bay.timeout', message: 'Function timed out after 30s' }
    });
  });

  it('reports boot errors', async () => {
    mocks.clusterManager.function.invoke.mockResolvedValue({
      ...successOutput,
      payload: {},
      bootError: true
    });

    expect(await invoke()).toMatchObject({
      type: 'error',
      error: { code: 'function_bay.function_error' }
    });
  });

  it('rejects payloads above the 6 MiB limit before calling the cluster-manager', async () => {
    let result = await invoke({ data: 'x'.repeat(6 * 1024 * 1024) });

    expect(result).toMatchObject({
      type: 'error',
      error: { code: 'function_bay.payload_too_large' }
    });
    expect(mocks.clusterManager.function.invoke).not.toHaveBeenCalled();
  });
});
