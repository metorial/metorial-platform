import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile, project } from '../index';
import { devRuntime, devRuntimeKeyFromSeed } from './runtime';

let root = () => mkdtempSync(join(tmpdir(), 'control-runtime-'));

describe('devRuntime', () => {
  test('is off unless METORIAL_DEV_RUNTIME=kubernetes', () => {
    expect(devRuntime({})).toBeUndefined();
    expect(devRuntime({ METORIAL_DEV_RUNTIME: 'local' })).toBeUndefined();
    expect(devRuntime({ METORIAL_DEV_RUNTIME: ' ' })).toBeUndefined();
    expect(() => devRuntime({ METORIAL_DEV_RUNTIME: 'knative' })).toThrow(/must be one of/);
  });

  test('derives key ids the way function-bay and the trust ConfigMaps do', () => {
    let seed = createHash('sha256')
      .update('metorial-runtime-dev-e2e-signing-key')
      .digest()
      .toString('base64url');

    expect(devRuntimeKeyFromSeed(seed)).toMatchObject({
      kid: '4332912093164269',
      publicKey: 'oe1YYXDkg5mGKpA5eOfkA_rkIalPMjEZap6gfs0eXa4'
    });
  });

  test('generates the signing keys once per checkout', () => {
    let directory = root();
    let first = devRuntime({
      METORIAL_DEV_RUNTIME: 'kubernetes',
      CONTROL_PROJECT_ROOT: directory
    })!;
    let second = devRuntime({
      METORIAL_DEV_RUNTIME: 'kubernetes',
      CONTROL_PROJECT_ROOT: directory
    })!;
    let path = join(directory, '.control', 'runtime-dev', 'keys.json');

    expect(second.keys).toEqual(first.keys);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(first.keys);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(first.keys.functions.kid).not.toBe(first.keys.build.kid);
    expect(devRuntimeKeyFromSeed(first.keys.build.seed)).toEqual(first.keys.build);
  });

  test('points function-bay at the forwarded cluster-manager and minted tokens', () => {
    let directory = root();
    let runtime = devRuntime({
      METORIAL_DEV_RUNTIME: 'kubernetes',
      CONTROL_PROJECT_ROOT: directory
    })!;
    let raw = compile(project({ name: 'fb', dependencies: runtime.functionsDependencies() }))
      .dependencies![0] as { identifier: string; start: boolean; env: unknown[] };

    expect(raw).toMatchObject({ identifier: '@metorial/runtime-dev', start: false });
    expect(raw.env).toEqual([
      {
        endpoint: 'control',
        key: 'CLUSTER_MANAGER_URL',
        value: 'http://127.0.0.1:{{BIND_PORT}}/rpc'
      },
      {
        endpoint: 'networkLogs',
        key: 'NETWORK_LOGS_URL',
        value: 'http://127.0.0.1:{{BIND_PORT}}/rpc'
      }
    ]);
    expect(runtime.functionsEnv()).toMatchObject({
      DEFAULT_PROVIDER: 'knative',
      CLUSTER_MANAGER_TOKEN_FILE: join(
        directory,
        '.control/runtime-dev/tokens/functions-cluster-manager'
      ),
      RUNTIME_SIGNING_KEY_ID: runtime.keys.functions.kid
    });
    expect(runtime.buildEnv()).toMatchObject({
      DEFAULT_PROVIDER: 'kubernetes',
      BUILD_SIGNING_KEY_ID: runtime.keys.build.kid
    });
  });
});
