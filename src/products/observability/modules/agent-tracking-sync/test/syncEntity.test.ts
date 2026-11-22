import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/links', async () => (await import('./_mocks')).linksModule);

vi.mock('../src/lib/settings', async importOriginal =>
  (await import('./_mocks')).settingsModule(importOriginal)
);

vi.mock('@metorial/queue', async () => (await import('./_mocks')).queueModule);

vi.mock('@metorial/db', () => ({
  db: {
    consumer: { findUnique: vi.fn() },
    consumerDevice: { findUnique: vi.fn() }
  }
}));

vi.mock('../src/lib/client', async () => (await import('./_mocks')).clientModule);

vi.mock('../src/lib/flag', async () => (await import('./_mocks')).flagModule);

import { db } from '@metorial/db';
import {
  backfillSyncEntityQueue,
  syncEntityQueue,
  syncEntityQueueProcessor
} from '../src/queues/syncEntity';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { links, mocks, resetMocks } from './_mocks';

mocks.agentTracking = {
  organization: { upsert: vi.fn(async () => ({ id: 'org_1' })) },
  entity: { upsert: vi.fn(), getByRef: vi.fn(), archive: vi.fn() },
  link: { upsert: vi.fn() }
};

let run = (data: { type: 'consumer' | 'device'; id: string }) =>
  (syncEntityQueueProcessor as any).processors[0].handler(data);

describe('agent-tracking/sync/entity queues', () => {
  it('drains backfills on their own queue and limiter with the same handler', () => {
    let [live, backfill] = (syncEntityQueueProcessor as any).processors;

    expect((syncEntityQueue as any).name).toBe('agent-tracking/sync/entity');
    expect((backfillSyncEntityQueue as any).name).toBe('agent-tracking/sync/entity/backfill');
    expect((syncEntityQueue as any).workerOpts.limiter).toEqual({ max: 20, duration: 1000 });
    expect((backfillSyncEntityQueue as any).workerOpts.limiter).toEqual({
      max: 10,
      duration: 1000
    });
    expect(backfill.handler).toBe(live.handler);
  });
});

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
  detections: [],
  detectionReportedAt: new Date(),
  ...overrides
});

describe('agent-tracking/sync/entity', () => {
  beforeEach(() => {
    resetMocks();
    mocks.agentTracking.entity.upsert.mockImplementation(async input => ({
      id: `gen_${input.kind}`,
      ...input
    }));
  });

  it('does nothing while agent tracking is not configured', async () => {
    mocks.enabled.value = false;

    await run({ type: 'consumer', id: 'con_1' });

    expect(db.consumer.findUnique).not.toHaveBeenCalled();
    expect(mocks.agentTracking.entity.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['consumer', () => vi.mocked(db.consumer.findUnique).mockResolvedValue(consumer as any)],
    [
      'device',
      () => vi.mocked(db.consumerDevice.findUnique).mockResolvedValue(createDevice() as any)
    ],
    [
      'device',
      () =>
        vi
          .mocked(db.consumerDevice.findUnique)
          .mockResolvedValue(createDevice({ status: 'revoked' }) as any)
    ]
  ] as const)(
    'leaves a %s alone while its organization does not have the agent tracking flag',
    async (type, load) => {
      mocks.flagged.value = false;
      load();

      await run({ type, id: 'any' });

      expect(mocks.flagChecks).toEqual([
        expect.objectContaining({ organization: expect.objectContaining({ id: 'org_1' }) })
      ]);
      expect(mocks.agentTracking.organization.upsert).not.toHaveBeenCalled();
      expect(mocks.agentTracking.entity.upsert).not.toHaveBeenCalled();
      expect(mocks.agentTracking.entity.getByRef).not.toHaveBeenCalled();
      expect(mocks.agentTracking.entity.archive).not.toHaveBeenCalled();
      expect(mocks.agentTracking.link.upsert).not.toHaveBeenCalled();
    }
  );

  it('upserts a consumer as a user entity', async () => {
    vi.mocked(db.consumer.findUnique).mockResolvedValue(consumer as any);

    await run({ type: 'consumer', id: 'con_1' });

    expect(mocks.agentTracking.organization.upsert).toHaveBeenCalledWith(
      {
        ref: 'org_1',
        name: 'Acme'
      },
      undefined
    );
    expect(mocks.agentTracking.entity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        kind: 'user',
        source: 'metorial.consumer',
        ref: 'con_1'
      })
    );
    expect(links.organization.has(1n)).toBe(true);
  });

  it('syncs a consumer without upserting a linked organization', async () => {
    links.organization.add(1n);
    vi.mocked(db.consumer.findUnique).mockResolvedValue(consumer as any);

    await run({ type: 'consumer', id: 'con_1' });

    expect(mocks.agentTracking.organization.upsert).not.toHaveBeenCalled();
    expect(mocks.agentTracking.entity.upsert).toHaveBeenCalledTimes(1);
  });

  it('relinks the organization once when the service lost it, then syncs the consumer', async () => {
    links.organization.add(1n);
    mocks.agentTracking.entity.upsert.mockRejectedValueOnce(
      new ServiceError(notFoundError('organization'))
    );
    vi.mocked(db.consumer.findUnique).mockResolvedValue(consumer as any);

    await run({ type: 'consumer', id: 'con_1' });

    expect(mocks.agentTracking.organization.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.agentTracking.entity.upsert).toHaveBeenCalledTimes(2);
    expect(links.organization.has(1n)).toBe(true);
  });

  it('skips consumers that no longer exist or whose organization was deleted', async () => {
    vi.mocked(db.consumer.findUnique).mockResolvedValueOnce(null);
    await run({ type: 'consumer', id: 'con_gone' });

    vi.mocked(db.consumer.findUnique).mockResolvedValueOnce({
      ...consumer,
      organization: { ...organization, status: 'deleted' }
    } as any);
    await run({ type: 'consumer', id: 'con_1' });

    expect(mocks.agentTracking.entity.upsert).not.toHaveBeenCalled();
  });

  it('upserts an active device, its owner link and its detected clients', async () => {
    vi.mocked(db.consumerDevice.findUnique).mockResolvedValue(createDevice() as any);

    await run({ type: 'device', id: 'codv_1' });

    let kinds = mocks.agentTracking.entity.upsert.mock.calls.map(([input]) => [
      input.kind,
      input.ref
    ]);
    expect(kinds).toEqual([
      ['user', 'con_1'],
      ['device', 'codv_1'],
      ['agent', 'claude-code'],
      ['agent', 'cursor']
    ]);
    expect(mocks.agentTracking.link.upsert).toHaveBeenCalledWith({
      organizationId: 'org_1',
      fromId: 'gen_device',
      toId: 'gen_user',
      type: 'owned_by',
      origin: 'sync',
      reach: 'from_now'
    });
    expect(mocks.agentTracking.entity.archive).not.toHaveBeenCalled();
  });

  it('upserts the agents detected on a device once, next to its configured clients', async () => {
    vi.mocked(db.consumerDevice.findUnique).mockResolvedValue(
      createDevice({
        detections: [{ toolKey: 'cursor' }, { toolKey: 'ollama' }, { toolKey: 'retired-tool' }]
      }) as any
    );

    await run({ type: 'device', id: 'codv_1' });

    let agents = mocks.agentTracking.entity.upsert.mock.calls
      .map(([input]) => input)
      .filter(input => input.kind == 'agent')
      .map(input => [input.ref, input.name]);
    expect(agents).toEqual([
      ['claude-code', 'Claude Code'],
      ['cursor', 'Cursor'],
      ['ollama', 'Ollama']
    ]);
  });

  it.each([
    ['detection is off', { detectionReportedAt: new Date() }, false],
    [
      'the last report is stale',
      { detectionReportedAt: new Date('2020-01-01T00:00:00Z') },
      true
    ]
  ])('leaves detected agents out when %s', async (_, overrides, detectionOn) => {
    mocks.aiToolDetection.value = detectionOn;
    vi.mocked(db.consumerDevice.findUnique).mockResolvedValue(
      createDevice({ detections: [{ toolKey: 'ollama' }], ...overrides }) as any
    );

    await run({ type: 'device', id: 'codv_1' });

    let agents = mocks.agentTracking.entity.upsert.mock.calls
      .map(([input]) => input)
      .filter(input => input.kind == 'agent')
      .map(input => input.ref);
    expect(agents).toEqual(['claude-code', 'cursor']);
  });

  it('archives the entity of an ended device', async () => {
    vi.mocked(db.consumerDevice.findUnique).mockResolvedValue(
      createDevice({ status: 'revoked' }) as any
    );
    mocks.agentTracking.entity.getByRef.mockResolvedValue({
      id: 'gen_device_1',
      status: 'managed'
    });

    await run({ type: 'device', id: 'codv_1' });

    expect(mocks.agentTracking.entity.getByRef).toHaveBeenCalledWith({
      organizationId: 'org_1',
      kind: 'device',
      source: 'metorial.device',
      ref: 'codv_1'
    });
    expect(mocks.agentTracking.entity.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      entityId: 'gen_device_1'
    });
    expect(mocks.agentTracking.entity.upsert).not.toHaveBeenCalled();
    expect(mocks.agentTracking.link.upsert).not.toHaveBeenCalled();
    expect(mocks.agentTracking.organization.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['never synced', null],
    ['already archived', { id: 'gen_device_1', status: 'archived' }],
    ['merged into another device', { id: 'gen_device_1', status: 'merged' }]
  ])('leaves an ended device alone when it was %s', async (_, entity) => {
    vi.mocked(db.consumerDevice.findUnique).mockResolvedValue(
      createDevice({ status: 'revoked' }) as any
    );
    mocks.agentTracking.entity.getByRef.mockResolvedValue(entity);

    await run({ type: 'device', id: 'codv_1' });

    expect(mocks.agentTracking.entity.archive).not.toHaveBeenCalled();
  });
});
