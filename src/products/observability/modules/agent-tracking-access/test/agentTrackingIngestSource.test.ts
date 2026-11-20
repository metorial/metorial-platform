import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', async () => {
  let { dbModule, instance } = await import('./_mocks');

  return dbModule(
    {
      agentTrackingIngestSource: {
        create: vi.fn(async ({ data }) => ({
          oid: 1n,
          status: 'active',
          revokedAt: null,
          serviceRevokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          instance,
          ...data
        })),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn()
      }
    },
    'atis_1'
  );
});
vi.mock('@metorial/fabric', async () => (await import('./_mocks')).fabricModule);
vi.mock(
  '@metorial/module-agent-tracking-sync',
  async () => (await import('./_mocks')).syncModule
);
vi.mock('../src/queues/revokeIngestSources', () => ({
  revokeIngestSourceQueue: { add: vi.fn() }
}));

import { db } from '@metorial/db';
import { revokeIngestSourceQueue } from '../src/queues/revokeIngestSources';
import { agentTrackingIngestSourceService } from '../src/services/agentTrackingIngestSource';
import {
  expectServiceError,
  instance,
  mocks,
  organization,
  project,
  resetMocks,
  settledWithin,
  unreachable
} from './_mocks';

let secret = 'metorial_agis_4eC39HqLyjWDarjt_T1zdp7dcSecretPartThatIsLongEnough0000p7dc';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: { ip: '127.0.0.1' }
} as any;

let createRecord = (overrides: Record<string, any> = {}) => ({
  oid: 7n,
  id: 'atis_1',
  status: 'active',
  serviceIngestSourceId: 'atis_service_1',
  name: 'Engineering laptops',
  clientFamily: 'claude_code',
  secretRedacted: 'metorial_agis_4eC3...p7dc',
  instanceOid: 3n,
  instance,
  revokedAt: null,
  serviceRevokedAt: null,
  createdAt: new Date('2026-11-18T10:00:00Z'),
  updatedAt: new Date('2026-11-18T10:00:00Z'),
  ...overrides
});

let create = () =>
  agentTrackingIngestSourceService.createIngestSource({
    organization: organization as any,
    project: project as any,
    instance: instance as any,
    auditScope,
    input: { name: 'Engineering laptops', clientFamily: 'claude_code' }
  });

let serialize = (value: unknown) =>
  JSON.stringify(value, (_, item) => (typeof item == 'bigint' ? item.toString() : item));

describe('agentTrackingIngestSourceService', () => {
  beforeEach(() => {
    resetMocks();
    mocks.agentTracking.ingestSource.create.mockResolvedValue({
      id: 'atis_service_1',
      secret
    });
    mocks.agentTracking.ingestSource.get.mockResolvedValue({
      lastUsedAt: '2026-11-18T11:00:00.000Z'
    });
  });

  describe('createIngestSource', () => {
    it('refuses an organization without the agent tracking flag and creates nothing', async () => {
      mocks.flagged.value = false;

      await expect(create()).rejects.toMatchObject({
        data: { status: 404, entity: 'agent_tracking.ingest_source' }
      });
      expect(mocks.fire).not.toHaveBeenCalled();
      expect(mocks.upsertInstanceScope).not.toHaveBeenCalled();
      expect(mocks.agentTracking.ingestSource.create).not.toHaveBeenCalled();
    });

    it('upserts the scope, creates the key in the service and mirrors it', async () => {
      let result = await create();

      expect(mocks.upsertInstanceScope).toHaveBeenCalledWith({
        organization,
        project,
        instance,
        callOpts: { timeoutMs: 3_000 }
      });
      expect(mocks.agentTracking.ingestSource.create).toHaveBeenCalledWith(
        {
          organizationId: 'org_1',
          instanceId: 'inst_1',
          name: 'Engineering laptops',
          family: 'claude-code',
          contentPolicy: { defaultMode: 'full' }
        },
        { timeoutMs: 5_000, retry: false }
      );
      expect(mocks.upsertInstanceScope.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.agentTracking.ingestSource.create.mock.invocationCallOrder[0]!
      );

      expect(db.agentTrackingIngestSource.create).toHaveBeenCalledWith({
        data: {
          id: 'atis_1',
          serviceIngestSourceId: 'atis_service_1',
          name: 'Engineering laptops',
          clientFamily: 'claude_code',
          secretRedacted: 'metorial_agis_4eC3...p7dc',
          instanceOid: 3n
        },
        include: { instance: { include: { organization: true } } }
      });

      expect(result).toMatchObject({
        secret,
        ingestUrl: 'https://ingest.example.com',
        lastUsedAt: null,
        lastUsedStatus: 'never_used',
        ingestSource: { id: 'atis_1' }
      });
    });

    it('never stores the secret or hands it to listeners', async () => {
      await create();

      let { data } = vi.mocked(db.agentTrackingIngestSource.create).mock.calls[0]![0] as any;

      expect(serialize(data)).not.toContain('T1zdp7dcSecretPart');
      expect(mocks.fire).toHaveBeenCalledWith(
        'agent_tracking.ingest_source.created:after',
        expect.objectContaining({ auditScope })
      );
      for (let [, payload] of mocks.fire.mock.calls) {
        expect(serialize(payload)).not.toContain('T1zdp7dcSecretPart');
      }
    });

    it('fires the before event ahead of any change', async () => {
      await create();

      expect(mocks.fire).toHaveBeenCalledWith('agent_tracking.ingest_source.created:before', {
        organization,
        instance,
        input: { name: 'Engineering laptops', clientFamily: 'claude_code' },
        auditScope
      });
      expect(mocks.fire.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.upsertInstanceScope.mock.invocationCallOrder[0]!
      );
      expect(mocks.upsertInstanceScope.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.agentTracking.ingestSource.create.mock.invocationCallOrder[0]!
      );
    });

    it('backfills the roster of the organization only after the commit', async () => {
      let result = await create();

      expect(result.secret).toBe(secret);
      expect(mocks.backfillRoster).not.toHaveBeenCalled();

      await Promise.all(mocks.afterCommit.map(hook => hook()));

      expect(mocks.backfillRoster).toHaveBeenCalledWith({ organization });
    });

    it('revokes the new key in the service when it cannot be mirrored', async () => {
      let failure = new Error('mirror insert failed');
      vi.mocked(db.agentTrackingIngestSource.create).mockRejectedValueOnce(failure);

      await expect(create()).rejects.toBe(failure);

      expect(mocks.agentTracking.ingestSource.revoke).toHaveBeenCalledWith(
        { organizationId: 'org_1', ingestSourceId: 'atis_service_1' },
        { timeoutMs: 3_000 }
      );
      expect(mocks.afterCommit).toHaveLength(0);
    });

    it('reports the mirror failure even when that revoke fails too', async () => {
      let failure = new Error('mirror insert failed');
      vi.mocked(db.agentTrackingIngestSource.create).mockRejectedValueOnce(failure);
      mocks.agentTracking.ingestSource.revoke.mockRejectedValueOnce(new Error('unreachable'));

      await expect(create()).rejects.toBe(failure);
    });

    it('fails within seconds while the service is unreachable', async () => {
      vi.useFakeTimers();
      try {
        mocks.agentTracking.ingestSource.create.mockImplementation((_, opts) =>
          unreachable(opts)
        );

        let pending = create();
        pending.catch(() => {});

        expect(await settledWithin(pending, 5_000)).toBe(true);
        await expect(pending).rejects.toThrow('Service unavailable');
        expect(db.agentTrackingIngestSource.create).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('rejects while agent tracking is not configured', async () => {
      mocks.enabled.value = false;

      await expectServiceError(create(), 'Agent tracking is not configured.');
      expect(mocks.agentTracking.ingestSource.create).not.toHaveBeenCalled();
    });

    it('rejects while the public ingest URL is not configured', async () => {
      mocks.settings.ingestPublicUrl = undefined;

      await expectServiceError(create(), 'Agent tracking is not configured.');
      expect(mocks.agentTracking.ingestSource.create).not.toHaveBeenCalled();
    });
  });

  describe('getIngestSourceById', () => {
    it('scopes the lookup to the instance', async () => {
      vi.mocked(db.agentTrackingIngestSource.findFirst).mockResolvedValue(
        createRecord() as any
      );

      await agentTrackingIngestSourceService.getIngestSourceById({
        instance: instance as any,
        ingestSourceId: 'atis_1'
      });

      expect(db.agentTrackingIngestSource.findFirst).toHaveBeenCalledWith({
        where: { id: 'atis_1', instanceOid: 3n },
        include: { instance: { include: { organization: true } } }
      });
    });

    it('throws not found for a key of another instance', async () => {
      vi.mocked(db.agentTrackingIngestSource.findFirst).mockResolvedValue(null);

      await expect(
        agentTrackingIngestSourceService.getIngestSourceById({
          instance: instance as any,
          ingestSourceId: 'atis_other'
        })
      ).rejects.toMatchObject({ data: { status: 404 } });
    });
  });

  describe('describeIngestSource', () => {
    it('adds when data last arrived and the ingest URL, never the secret', async () => {
      let view = await agentTrackingIngestSourceService.describeIngestSource({
        ingestSource: createRecord() as any
      });

      expect(mocks.agentTracking.ingestSource.get).toHaveBeenCalledWith(
        { organizationId: 'org_1', ingestSourceId: 'atis_service_1' },
        { timeoutMs: 2_000, retry: false, captureErrors: false }
      );
      expect(view).toMatchObject({
        ingestUrl: 'https://ingest.example.com',
        lastUsedAt: new Date('2026-11-18T11:00:00.000Z'),
        lastUsedStatus: 'used',
        secret: null
      });
    });

    it('tells a key that was never used from one whose last use is unknown', async () => {
      mocks.agentTracking.ingestSource.get.mockResolvedValueOnce({ lastUsedAt: null } as any);

      let view = await agentTrackingIngestSourceService.describeIngestSource({
        ingestSource: createRecord() as any
      });

      expect(view).toMatchObject({ lastUsedAt: null, lastUsedStatus: 'never_used' });
    });

    it('answers within seconds while the service is unreachable', async () => {
      vi.useFakeTimers();
      try {
        mocks.agentTracking.ingestSource.get.mockImplementation((_, opts) =>
          unreachable(opts)
        );

        let pending = agentTrackingIngestSourceService.describeIngestSource({
          ingestSource: createRecord() as any
        });

        expect(await settledWithin(pending, 2_000)).toBe(true);

        let view = await pending;
        expect(view.lastUsedAt).toBeNull();
        expect(view.lastUsedStatus).toBe('unknown');
        expect(view.ingestSource.id).toBe('atis_1');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('listIngestSources', () => {
    it('lists active keys of the instance by default', async () => {
      vi.mocked(db.agentTrackingIngestSource.findMany).mockResolvedValue([
        createRecord()
      ] as any);

      let paginator = await agentTrackingIngestSourceService.listIngestSources({
        instance: instance as any
      });
      let list = await paginator.run({});

      expect(db.agentTrackingIngestSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { instanceOid: 3n, status: 'active' } })
      );
      expect(list.items).toHaveLength(1);
      expect(list.items[0]).toMatchObject({ secret: null, ingestSource: { id: 'atis_1' } });
    });

    it('filters on the statuses given, and an empty list matches nothing', async () => {
      vi.mocked(db.agentTrackingIngestSource.findMany).mockResolvedValue([]);

      await (
        await agentTrackingIngestSourceService.listIngestSources({
          instance: instance as any,
          statuses: ['revoked']
        })
      ).run({});
      await (
        await agentTrackingIngestSourceService.listIngestSources({
          instance: instance as any,
          statuses: []
        })
      ).run({});

      expect(db.agentTrackingIngestSource.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { instanceOid: 3n, status: { in: ['revoked'] } } })
      );
      expect(db.agentTrackingIngestSource.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { instanceOid: 3n, status: { in: [] } } })
      );
    });
  });

  describe('revokeIngestSource', () => {
    it('marks the mirror revoked first and revokes in the service from a queue', async () => {
      let previous = createRecord();
      let revoked = createRecord({ status: 'revoked', revokedAt: new Date() });
      vi.mocked(db.agentTrackingIngestSource.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(db.agentTrackingIngestSource.findUniqueOrThrow).mockResolvedValue(
        revoked as any
      );

      let view = await agentTrackingIngestSourceService.revokeIngestSource({
        ingestSource: previous as any,
        auditScope
      });

      expect(db.agentTrackingIngestSource.updateMany).toHaveBeenCalledWith({
        where: { oid: 7n, status: 'active' },
        data: { status: 'revoked', revokedAt: expect.any(Date) }
      });
      expect(mocks.fire).toHaveBeenCalledWith('agent_tracking.ingest_source.revoked:after', {
        ingestSource: revoked,
        previousIngestSource: previous,
        auditScope
      });
      expect(revokeIngestSourceQueue.add).not.toHaveBeenCalled();

      await Promise.all(mocks.afterCommit.map(hook => hook()));

      expect(revokeIngestSourceQueue.add).toHaveBeenCalledWith(
        { ingestSourceId: 'atis_1' },
        { id: 'atis_1' }
      );
      expect(view.ingestSource.status).toBe('revoked');
    });

    it('returns within seconds while the service is unreachable', async () => {
      vi.useFakeTimers();
      try {
        mocks.agentTracking.ingestSource.get.mockImplementation((_, opts) =>
          unreachable(opts)
        );
        vi.mocked(db.agentTrackingIngestSource.updateMany).mockResolvedValue({ count: 1 });
        vi.mocked(db.agentTrackingIngestSource.findUniqueOrThrow).mockResolvedValue(
          createRecord({ status: 'revoked', revokedAt: new Date() }) as any
        );

        let pending = agentTrackingIngestSourceService.revokeIngestSource({
          ingestSource: createRecord() as any,
          auditScope
        });

        expect(await settledWithin(pending, 2_000)).toBe(true);
        expect((await pending).ingestSource.status).toBe('revoked');
      } finally {
        vi.useRealTimers();
      }
    });

    it('treats revoking a revoked key as done', async () => {
      let revoked = createRecord({ status: 'revoked', revokedAt: new Date() });
      vi.mocked(db.agentTrackingIngestSource.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(db.agentTrackingIngestSource.findUniqueOrThrow).mockResolvedValue(
        revoked as any
      );

      let view = await agentTrackingIngestSourceService.revokeIngestSource({
        ingestSource: revoked as any,
        auditScope
      });

      expect(mocks.fire).not.toHaveBeenCalled();
      expect(mocks.afterCommit).toHaveLength(0);
      expect(view.ingestSource.status).toBe('revoked');
    });
  });
});
