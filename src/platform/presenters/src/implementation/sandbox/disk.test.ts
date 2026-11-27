import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-sandbox', () => ({
  sandboxFailureCodes: ['internal_error'],
  sandboxBuildFailureCodes: ['internal_error']
}));

import { v1SandboxDiskPresenter } from './disk';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let localDisk = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'sbd_1',
    type: 'standard',
    name: 'data',
    status: 'active',
    sizeBytes: 4096n,
    tenant: { region: { identifier: 'us-east-1' } },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    deletedAt: null,
    remote: null,
    ...overrides
  }) as any;

describe('v1SandboxDiskPresenter', () => {
  it('presents the remote disk with the local name', async () => {
    let result = await v1SandboxDiskPresenter
      .present(
        {
          disk: localDisk({
            remote: {
              status: 'active',
              sizeBytes: '8192',
              machine: { machineId: 'sbm_1', mountPath: '/data' },
              resize: { id: 'sbr_1', status: 'running', targetSizeBytes: '16384' }
            }
          })
        },
        context
      )
      .run();

    expect(result).toMatchObject({
      object: 'sandbox.disk',
      id: 'sbd_1',
      name: 'data',
      status: 'active',
      region: 'us-east-1',
      size_bytes: 8192,
      machine: { id: 'sbm_1', mount_path: '/data' },
      active_resize: { id: 'sbr_1', status: 'running', target_size_bytes: 16384 }
    });
  });

  it('falls back to the local record for a deleted disk', async () => {
    let deletedAt = new Date('2026-02-01T00:00:00Z');

    let result = await v1SandboxDiskPresenter
      .present({ disk: localDisk({ status: 'deleted', deletedAt }) }, context)
      .run();

    expect(result).toMatchObject({
      name: 'data',
      status: 'deleted',
      size_bytes: 4096,
      machine: null,
      active_resize: null,
      deleted_at: deletedAt
    });
  });

  it('reports a null size when none was ever recorded', async () => {
    let result = await v1SandboxDiskPresenter
      .present(
        { disk: localDisk({ status: 'deleted', sizeBytes: null, name: null }) },
        context
      )
      .run();

    expect(result.size_bytes).toBeNull();
    expect(result.name).toBeNull();
  });

  it('reports a disk without a remote record that is not deleted as cloning', async () => {
    let result = await v1SandboxDiskPresenter
      .present({ disk: localDisk({ status: 'active' }) }, context)
      .run();

    expect(result.status).toBe('cloning');
  });
});

it('returns local metadata even when the remote is missing', async () => {
  let result = await v1SandboxDiskPresenter
    .present(
      { disk: localDisk({ metadata: { app: 'test', nested: { enabled: true } } }) },
      context
    )
    .run();

  expect(result.metadata).toEqual({ app: 'test', nested: { enabled: true } });
});
