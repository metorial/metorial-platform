import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  importBundle: vi.fn(),
  getRuntime: vi.fn(),
  decryptEnv: vi.fn(),
  db: {
    functionVersion: { findUnique: vi.fn(), update: vi.fn() },
    functionDeploymentStep: { findFirst: vi.fn(), update: vi.fn() }
  }
}));

vi.mock('@metorial-platform-systems/cluster-manager-client', () => ({
  createClusterManagerClient: () => ({ bundle: { import: mocks.importBundle } })
}));
vi.mock('../../env', () => ({
  env: { clusterManager: { CLUSTER_MANAGER_URL: 'http://cluster-manager.local' } }
}));
vi.mock('../../db', () => ({ db: mocks.db }));
vi.mock('../../storage', () => ({ storage: {} }));
vi.mock('../../encryption', () => ({
  encryption: {
    encrypt: async (d: { entityId: string; secret: string }) => `enc:${d.entityId}:${d.secret}`
  }
}));
vi.mock('../../lib/decryptFunctionVersionEnvironmentVariables', () => ({
  decryptFunctionVersionEnvironmentVariables: mocks.decryptEnv
}));
vi.mock('./runtime', () => ({ getRuntime: mocks.getRuntime }));

import { rehomeLocalFunctionVersion } from './rehome';

let bundle = {
  bucket: 'function-bay-bundles',
  key: 'bundles/functionVersion_1.tar.zst',
  sha256: 'b'.repeat(64),
  sizeBytes: 99
};

let localVersion = {
  oid: 11n,
  id: 'functionVersion_1',
  providerData: {
    bucket: 'function-bay-bundles',
    storageKey: 'local/provider/functionVersion_1.zip',
    handler: 'index.handler',
    runtimeIdentifier: 'local-runtime',
    encryptedEnvironmentVariables: 'local-env'
  },
  runtime: {
    configuration: { runtime: { identifier: 'nodejs', version: '22.x' } },
    provider: { identifier: 'local' }
  }
};

describe('rehomeLocalFunctionVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.functionVersion.findUnique.mockResolvedValue(localVersion);
    mocks.importBundle.mockResolvedValue(bundle);
    mocks.getRuntime.mockResolvedValue({
      runtime: { oid: 99n, identifier: 'knative-runtime' }
    });
    mocks.db.functionDeploymentStep.findFirst.mockResolvedValue({
      oid: 5n,
      output: '[1,"done"]'
    });
  });

  it('imports the existing bundle and moves the version to the knative runtime', async () => {
    mocks.decryptEnv.mockResolvedValue({ API_KEY: 'secret' });

    await rehomeLocalFunctionVersion('functionVersion_1');

    expect(mocks.decryptEnv).toHaveBeenCalledWith(
      expect.objectContaining({ encryptedEnvironmentVariables: 'local-env' })
    );
    expect(mocks.getRuntime).toHaveBeenCalledWith({ identifier: 'nodejs', version: '22.x' });
    expect(mocks.importBundle).toHaveBeenCalledWith({
      versionId: 'functionVersion_1',
      source: { bucket: 'function-bay-bundles', key: 'local/provider/functionVersion_1.zip' }
    });
    expect(mocks.db.functionVersion.update).toHaveBeenCalledWith({
      where: { oid: 11n },
      data: {
        runtimeOid: 99n,
        providerData: {
          bundle,
          entrypoint: { path: 'index.js', export: 'handler', kind: 'enveloped' },
          runtimeIdentifier: 'knative-runtime',
          encryptedEnvironmentVariables: 'enc:functionVersion_1:{"API_KEY":"secret"}'
        }
      }
    });
    expect(mocks.db.functionDeploymentStep.update).not.toHaveBeenCalled();
  });

  it('drops reserved env names and records a warning in the deployment log', async () => {
    mocks.decryptEnv.mockResolvedValue({
      API_KEY: 'secret',
      NODE_OPTIONS: '--max-old-space-size=512',
      EGRESS_GATEWAY_ADDR: 'x'
    });

    await rehomeLocalFunctionVersion('functionVersion_1');

    let update = mocks.db.functionVersion.update.mock.calls[0]![0];
    expect(update.data.providerData.encryptedEnvironmentVariables).toBe(
      'enc:functionVersion_1:{"API_KEY":"secret"}'
    );
    expect(update.data.encryptedEnvironmentVariables).toBe(
      'enc:functionVersion_1:{"API_KEY":"secret"}'
    );

    let stepUpdate = mocks.db.functionDeploymentStep.update.mock.calls[0]![0];
    expect(stepUpdate.where).toEqual({ oid: 5n });
    expect(stepUpdate.data.output).toContain('NODE_OPTIONS, EGRESS_GATEWAY_ADDR');
  });

  it('leaves versions alone that are no longer on the local provider', async () => {
    mocks.db.functionVersion.findUnique.mockResolvedValue({
      ...localVersion,
      runtime: { ...localVersion.runtime, provider: { identifier: 'knative' } }
    });

    await rehomeLocalFunctionVersion('functionVersion_1');

    expect(mocks.importBundle).not.toHaveBeenCalled();
    expect(mocks.db.functionVersion.update).not.toHaveBeenCalled();
  });
});
