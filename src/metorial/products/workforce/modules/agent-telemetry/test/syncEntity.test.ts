import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  groundstation: {
    organization: { upsert: vi.fn() },
    entity: { upsert: vi.fn(), getByRef: vi.fn(), archive: vi.fn() },
    link: { upsert: vi.fn() }
  },
  enabled: { value: true }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    consumer: { findUnique: vi.fn() },
    consumerDevice: { findUnique: vi.fn() }
  }
}));

vi.mock('../src/lib/client', () => ({
  getGroundstation: () => (mocks.enabled.value ? mocks.groundstation : null),
  ignoreNotFound: (promise: Promise<unknown>) => promise
}));

import { db } from '@metorial/db';
import { syncEntityQueueProcessor } from '../src/queues/syncEntity';

let run = (data: { type: 'consumer' | 'device'; id: string }) =>
  (syncEntityQueueProcessor as any).handler(data);

let organization = { oid: 1n, id: 'org_1', name: 'Acme', status: 'active' };

let consumer = {
  oid: 10n,
  id: 'con_1',
  name: 'Ada',
  email: 'ada@example.com',
  isServiceAccount: false,
  organization,
  profiles: [{ id: 'cop_1', email: 'ada@example.com', status: 'active' }],
  instanceConsumers: []
};

let createDevice = (overrides: Record<string, any> = {}) => ({
  oid: 20n,
  id: 'codv_1',
  status: 'active',
  name: "Ada's Mac",
  os: 'macos',
  arch: 'aarch64',
  appVersion: '0.2.0',
  installationId: 'install-1',
  instance: { id: 'inst_1', organization },
  consumerProfile: { consumer },
  clients: [
    { name: 'Claude Code', mcpClientType: { key: 'claude-code' } },
    { name: 'Cursor', mcpClientType: { key: 'cursor' } }
  ],
  ...overrides
});

describe('agent-telemetry/sync/entity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
    mocks.groundstation.entity.upsert.mockImplementation(async input => ({
      id: `gen_${input.kind}`,
      ...input
    }));
  });

  it('does nothing while Groundstation is not configured', async () => {
    mocks.enabled.value = false;

    await run({ type: 'consumer', id: 'con_1' });

    expect(db.consumer.findUnique).not.toHaveBeenCalled();
    expect(mocks.groundstation.entity.upsert).not.toHaveBeenCalled();
  });

  it('upserts a consumer as a user entity', async () => {
    vi.mocked(db.consumer.findUnique).mockResolvedValue(consumer as any);

    await run({ type: 'consumer', id: 'con_1' });

    expect(mocks.groundstation.organization.upsert).toHaveBeenCalledWith({
      ref: 'org_1',
      name: 'Acme'
    });
    expect(mocks.groundstation.entity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        kind: 'user',
        source: 'metorial.consumer',
        ref: 'con_1'
      })
    );
  });

  it('skips consumers that no longer exist or whose organization was deleted', async () => {
    vi.mocked(db.consumer.findUnique).mockResolvedValueOnce(null);
    await run({ type: 'consumer', id: 'con_gone' });

    vi.mocked(db.consumer.findUnique).mockResolvedValueOnce({
      ...consumer,
      organization: { ...organization, status: 'deleted' }
    } as any);
    await run({ type: 'consumer', id: 'con_1' });

    expect(mocks.groundstation.entity.upsert).not.toHaveBeenCalled();
  });

  it('upserts an active device, its owner link and its detected clients', async () => {
    vi.mocked(db.consumerDevice.findUnique).mockResolvedValue(createDevice() as any);

    await run({ type: 'device', id: 'codv_1' });

    let kinds = mocks.groundstation.entity.upsert.mock.calls.map(([input]) => [
      input.kind,
      input.ref
    ]);
    expect(kinds).toEqual([
      ['user', 'con_1'],
      ['device', 'codv_1'],
      ['agent', 'claude-code'],
      ['agent', 'cursor']
    ]);
    expect(mocks.groundstation.link.upsert).toHaveBeenCalledWith({
      organizationId: 'org_1',
      fromId: 'gen_device',
      toId: 'gen_user',
      type: 'owned_by',
      origin: 'sync',
      reach: 'from_now'
    });
    expect(mocks.groundstation.entity.archive).not.toHaveBeenCalled();
  });

  it('archives the entity of an ended device', async () => {
    vi.mocked(db.consumerDevice.findUnique).mockResolvedValue(
      createDevice({ status: 'revoked' }) as any
    );
    mocks.groundstation.entity.getByRef.mockResolvedValue({
      id: 'gen_device_1',
      status: 'managed'
    });

    await run({ type: 'device', id: 'codv_1' });

    expect(mocks.groundstation.entity.getByRef).toHaveBeenCalledWith({
      organizationId: 'org_1',
      kind: 'device',
      source: 'metorial.device',
      ref: 'codv_1'
    });
    expect(mocks.groundstation.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_device_1'
    });
    expect(mocks.groundstation.entity.upsert).not.toHaveBeenCalled();
    expect(mocks.groundstation.link.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['never synced', null],
    ['already archived', { id: 'gen_device_1', status: 'archived' }],
    ['merged into another device', { id: 'gen_device_1', status: 'merged' }]
  ])('leaves an ended device alone when it was %s', async (_, entity) => {
    vi.mocked(db.consumerDevice.findUnique).mockResolvedValue(
      createDevice({ status: 'revoked' }) as any
    );
    mocks.groundstation.entity.getByRef.mockResolvedValue(entity);

    await run({ type: 'device', id: 'codv_1' });

    expect(mocks.groundstation.entity.archive).not.toHaveBeenCalled();
  });
});
