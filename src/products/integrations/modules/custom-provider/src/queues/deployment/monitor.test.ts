import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    customProviderDeployment: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    customProviderVersion: { updateMany: vi.fn() },
    shuttleServerVersion: { upsert: vi.fn() }
  },
  monitorQueueAdd: vi.fn(),
  failedQueueAdd: vi.fn(),
  succeededQueueAdd: vi.fn(),
  getTenantForShuttle: vi.fn(),
  getDeployment: vi.fn(),
  getVersion: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({
    add: mocks.monitorQueueAdd,
    process: (handler: any) => handler
  }),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mocks.db,
  snowflake: { nextId: () => 100n }
}));

vi.mock('@metorial-subspace/provider-shuttle/src/client', () => ({
  getTenantForShuttle: mocks.getTenantForShuttle,
  shuttle: {
    serverDeployment: { get: mocks.getDeployment },
    serverVersion: { get: mocks.getVersion }
  }
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('./failed', () => ({
  customDeploymentFailedQueue: { add: mocks.failedQueueAdd }
}));

vi.mock('./succeeded', () => ({
  customDeploymentSucceededQueue: { add: mocks.succeededQueueAdd }
}));

import { customDeploymentMonitorQueueProcessor } from './monitor';

let deployment = {
  oid: 1n,
  id: 'kcpd_1',
  status: 'deploying',
  customProvider: { status: 'active' },
  shuttleCustomServerDeployment: { id: 'dep_1' },
  shuttleCustomServer: { server: { oid: 2n, id: 'ser_1' } },
  tenant: { oid: 3n }
};

let runProcessor = () =>
  (customDeploymentMonitorQueueProcessor as any)({ customProviderDeploymentId: deployment.id });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.customProviderDeployment.findFirst.mockResolvedValue(deployment);
  mocks.getTenantForShuttle.mockResolvedValue({ id: 'ten_1' });
});

describe('custom deployment monitor', () => {
  it('forwards a failed Shuttle deployment to custom-provider failure handling', async () => {
    mocks.getDeployment.mockResolvedValue({ status: 'failed' });

    await runProcessor();

    expect(mocks.failedQueueAdd).toHaveBeenCalledWith({
      customProviderDeploymentId: deployment.id
    });
    expect(mocks.monitorQueueAdd).not.toHaveBeenCalled();
  });

  it('links the Shuttle version and forwards a successful deployment', async () => {
    mocks.getDeployment.mockResolvedValue({
      status: 'succeeded',
      serverVersionId: 'ver_1'
    });
    mocks.getVersion.mockResolvedValue({ id: 'ver_1' });
    mocks.db.shuttleServerVersion.upsert.mockResolvedValue({ oid: 4n });

    await runProcessor();

    expect(mocks.db.customProviderDeployment.updateMany).toHaveBeenCalledWith({
      where: { id: deployment.id },
      data: { shuttleServerVersionOid: 4n }
    });
    expect(mocks.succeededQueueAdd).toHaveBeenCalledWith({
      customProviderDeploymentId: deployment.id
    });
    expect(mocks.monitorQueueAdd).not.toHaveBeenCalled();
  });
});
