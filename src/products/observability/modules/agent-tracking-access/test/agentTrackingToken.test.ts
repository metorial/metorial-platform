import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', async () =>
  (await import('./_mocks')).dbModule(
    {
      $queryRaw: vi.fn(),
      consumerDevice: { findUniqueOrThrow: vi.fn() },
      instance: { findUniqueOrThrow: vi.fn() },
      agentTrackingIngestToken: {
        findMany: vi.fn(),
        create: vi.fn(async ({ data }) => ({ oid: 1n, status: 'active', ...data })),
        update: vi.fn(async ({ data }) => data)
      }
    },
    'atit_1'
  )
);
vi.mock('@metorial/fabric', async () => (await import('./_mocks')).fabricModule);
vi.mock(
  '@metorial/module-agent-tracking-sync',
  async () => (await import('./_mocks')).syncModule
);
vi.mock('../src/queues/revokeTokens', () => ({
  revokeIngestTokenQueue: { addManyWithOps: vi.fn() }
}));

import { db } from '@metorial/db';
import { revokeIngestTokenQueue } from '../src/queues/revokeTokens';
import { agentTrackingTokenService } from '../src/services/agentTrackingToken';
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

let consumer = { oid: 10n, id: 'con_1', organizationOid: 1n, isServiceAccount: false };

let createDevice = (overrides: Record<string, any> = {}) => ({
  oid: 20n,
  id: 'codv_1',
  status: 'active',
  name: "Ada's Mac",
  instance,
  consumerProfile: { consumer },
  ...overrides
});

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  actor: { type: 'consumer_profile' as const, id: 'cpf_1' },
  context: { ip: '127.0.0.1' }
} as any;

describe('agentTrackingTokenService', () => {
  beforeEach(() => {
    resetMocks();
    mocks.agentTracking.ingestToken.create.mockResolvedValue({
      id: 'git_new',
      secret: 'metorial_agit_secret',
      expiresAt: null
    });
  });

  describe('listDeviceTelemetry', () => {
    let scope = { organization: { id: 'org_1' }, project: { id: 'proj_1' } } as any;
    let active = { oid: 1n, status: 'active' as const };
    let rotated = { oid: 2n, status: 'active' as const };
    let signedOut = { oid: 3n, status: 'signed_out' as const };

    it('returns the newest active bound token of each signed-in device', async () => {
      vi.mocked(db.agentTrackingIngestToken.findMany).mockResolvedValue([
        { consumerDeviceOid: 2n, serviceIngestTokenId: 'git_old' },
        { consumerDeviceOid: 2n, serviceIngestTokenId: 'git_new' }
      ] as any);

      let telemetry = await agentTrackingTokenService.listDeviceTelemetry({
        ...scope,
        consumerDevices: [active, rotated, signedOut]
      });

      expect(db.agentTrackingIngestToken.findMany).toHaveBeenCalledWith({
        where: { consumerDeviceOid: { in: [1n, 2n] }, status: 'active', deviceMode: 'bound' },
        orderBy: { oid: 'asc' },
        select: { consumerDeviceOid: true, serviceIngestTokenId: true }
      });
      expect(telemetry.get(1n)).toEqual({ enabled: true, tokenId: null, toolDetails: false });
      expect(telemetry.get(2n)).toEqual({
        enabled: true,
        tokenId: 'git_new',
        toolDetails: false
      });
      expect(telemetry.get(3n)).toEqual({ enabled: true, tokenId: null, toolDetails: false });
      expect(mocks.agentTracking.ingestToken.create).not.toHaveBeenCalled();
    });

    it('reports no token and reads nothing while telemetry is off for the organization', async () => {
      mocks.flagged.value = false;

      let telemetry = await agentTrackingTokenService.listDeviceTelemetry({
        ...scope,
        consumerDevices: [active]
      });

      expect(telemetry.get(1n)).toEqual({ enabled: false, tokenId: null, toolDetails: false });
      expect(db.agentTrackingIngestToken.findMany).not.toHaveBeenCalled();
    });

    it('carries the instance setting for detailed tool reporting only while telemetry is on', async () => {
      mocks.toolDetails.value = true;
      vi.mocked(db.agentTrackingIngestToken.findMany).mockResolvedValue([]);

      let on = await agentTrackingTokenService.listDeviceTelemetry({
        ...scope,
        consumerDevices: [active]
      });
      mocks.flagged.value = false;
      let off = await agentTrackingTokenService.listDeviceTelemetry({
        ...scope,
        consumerDevices: [active]
      });

      expect(on.get(1n)).toEqual({ enabled: true, tokenId: null, toolDetails: true });
      expect(off.get(1n)).toEqual({ enabled: false, tokenId: null, toolDetails: false });
    });

    it('reports telemetry off while the public ingest URL is not set', async () => {
      mocks.settings.ingestPublicUrl = undefined;

      let telemetry = await agentTrackingTokenService.listDeviceTelemetry({
        ...scope,
        consumerDevices: [active]
      });

      expect(telemetry.get(1n)).toEqual({ enabled: false, tokenId: null, toolDetails: false });
    });
  });

  describe('issueDeviceToken', () => {
    it('refuses an organization without the agent tracking flag and creates nothing', async () => {
      mocks.flagged.value = false;
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);

      await expect(
        agentTrackingTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        })
      ).rejects.toMatchObject({
        data: { status: 404, entity: 'consumer.device.telemetry_token' }
      });
      expect(mocks.flagChecks).toEqual([{ organization, project }]);
      expect(mocks.withInstanceScope).not.toHaveBeenCalled();
      expect(mocks.agentTracking.ingestToken.create).not.toHaveBeenCalled();
      expect(db.agentTrackingIngestToken.create).not.toHaveBeenCalled();
    });

    it('binds a token to the consumer and device on the device instance', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);
      vi.mocked(db.agentTrackingIngestToken.findMany).mockResolvedValue([]);

      let result = await agentTrackingTokenService.issueDeviceToken({
        consumerDevice: { oid: 20n },
        auditScope
      });

      expect(mocks.withInstanceScope).toHaveBeenCalledWith(
        { organization, project, instance, callOpts: { timeoutMs: 3_000 } },
        expect.any(Function)
      );
      expect(mocks.agentTracking.ingestToken.create).toHaveBeenCalledWith(
        {
          organizationId: 'org_1',
          instanceId: 'inst_1',
          name: "Ada's Mac",
          userRef: 'con_1',
          deviceRef: 'codv_1',
          deviceMode: 'bound',
          contentPolicy: { defaultMode: 'full' }
        },
        { timeoutMs: 5_000, retry: false }
      );
      expect(db.agentTrackingIngestToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceMode: 'bound',
          serviceIngestTokenId: 'git_new',
          consumerOid: 10n,
          consumerDeviceOid: 20n,
          instanceOid: 3n
        })
      });
      expect(result).toMatchObject({
        secret: 'metorial_agit_secret',
        ingestUrl: 'https://ingest.example.com',
        expiresAt: null,
        ingestToken: { id: 'atit_1', serviceIngestTokenId: 'git_new' }
      });

      await Promise.all(mocks.afterCommit.map(hook => hook()));

      expect(mocks.syncEntities).toHaveBeenCalledWith({
        entities: [
          { type: 'consumer', id: 'con_1' },
          { type: 'device', id: 'codv_1' }
        ]
      });
    });

    it('answers within seconds while the service is unreachable', async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(
          createDevice() as any
        );

        mocks.withInstanceScope.mockImplementationOnce(({ callOpts }) =>
          unreachable(callOpts)
        );
        let scopeDown = agentTrackingTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        });
        scopeDown.catch(() => {});
        expect(await settledWithin(scopeDown, 3_000)).toBe(true);

        mocks.agentTracking.ingestToken.create.mockImplementationOnce((_, opts) =>
          unreachable(opts)
        );
        let createDown = agentTrackingTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        });
        createDown.catch(() => {});
        expect(await settledWithin(createDown, 5_000)).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('fires the created event without the secret', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);
      vi.mocked(db.agentTrackingIngestToken.findMany).mockResolvedValue([]);

      await agentTrackingTokenService.issueDeviceToken({
        consumerDevice: { oid: 20n },
        auditScope
      });

      expect(mocks.fire).toHaveBeenCalledWith('agent_tracking.ingest_token.created:after', {
        ingestToken: expect.objectContaining({
          id: 'atit_1',
          consumer: expect.objectContaining({ id: 'con_1' }),
          consumerDevice: expect.objectContaining({ id: 'codv_1' })
        }),
        replacedIngestTokenIds: [],
        auditScope
      });
      let fired = JSON.stringify(mocks.fire.mock.calls, (_, value) =>
        typeof value == 'bigint' ? value.toString() : value
      );
      expect(fired).not.toContain('metorial_agit_secret');
    });

    it('revokes the previous tokens of the device after commit', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);
      vi.mocked(db.agentTrackingIngestToken.findMany).mockResolvedValue([
        { id: 'atit_old' }
      ] as any);

      await agentTrackingTokenService.issueDeviceToken({
        consumerDevice: { oid: 20n },
        auditScope
      });

      expect(revokeIngestTokenQueue.addManyWithOps).not.toHaveBeenCalled();
      expect(mocks.fire).toHaveBeenCalledWith(
        'agent_tracking.ingest_token.created:after',
        expect.objectContaining({ replacedIngestTokenIds: ['atit_old'] })
      );

      await Promise.all(mocks.afterCommit.map(hook => hook()));

      expect(revokeIngestTokenQueue.addManyWithOps).toHaveBeenCalledWith([
        { data: { ingestTokenId: 'atit_old' }, opts: { id: 'atit_old' } }
      ]);
    });

    it('locks the device before reading the tokens it replaces', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);
      vi.mocked(db.agentTrackingIngestToken.findMany).mockResolvedValue([]);

      await agentTrackingTokenService.issueDeviceToken({
        consumerDevice: { oid: 20n },
        auditScope
      });

      let [query, deviceOid] = vi.mocked(db.$queryRaw).mock.calls[0]! as any;
      expect(query.join('?')).toMatch(/FROM "ConsumerDevice" WHERE "oid" = \? FOR UPDATE/);
      expect(deviceOid).toBe(20n);
      expect(vi.mocked(db.$queryRaw).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(db.agentTrackingIngestToken.findMany).mock.invocationCallOrder[0]!
      );
    });

    it('returns the secret when the sync after commit fails', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);
      vi.mocked(db.agentTrackingIngestToken.findMany).mockResolvedValue([]);
      mocks.syncEntities.mockRejectedValueOnce(new Error('Queue unavailable'));

      let result = await agentTrackingTokenService.issueDeviceToken({
        consumerDevice: { oid: 20n },
        auditScope
      });

      expect(result.secret).toBe('metorial_agit_secret');
      expect(mocks.syncEntities).not.toHaveBeenCalled();
      await Promise.allSettled(mocks.afterCommit.map(hook => hook()));
      expect(mocks.syncEntities).toHaveBeenCalled();
    });

    it('revokes the new token in the service when it cannot be stored', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);
      vi.mocked(db.agentTrackingIngestToken.findMany).mockResolvedValue([]);
      vi.mocked(db.agentTrackingIngestToken.create).mockRejectedValueOnce(
        new Error('Database unavailable')
      );

      await expect(
        agentTrackingTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        })
      ).rejects.toThrow('Database unavailable');

      expect(mocks.agentTracking.ingestToken.revoke).toHaveBeenCalledWith(
        { organizationId: 'org_1', ingestTokenId: 'git_new' },
        { timeoutMs: 3_000 }
      );
      expect(mocks.afterCommit).toHaveLength(0);
    });

    it('rejects a device that is no longer signed in', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(
        createDevice({ status: 'revoked' }) as any
      );

      await expectServiceError(
        agentTrackingTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        }),
        'This device is no longer signed in.'
      );
      expect(mocks.agentTracking.ingestToken.create).not.toHaveBeenCalled();
    });

    it('rejects while agent tracking is not configured', async () => {
      mocks.enabled.value = false;
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);

      await expectServiceError(
        agentTrackingTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        }),
        'Agent tracking is not configured.'
      );
      expect(mocks.agentTracking.ingestToken.create).not.toHaveBeenCalled();
    });

    it('rejects while the public ingest URL is not configured', async () => {
      mocks.settings.ingestPublicUrl = undefined;
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);

      await expectServiceError(
        agentTrackingTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        }),
        'Agent tracking is not configured.'
      );
      expect(mocks.agentTracking.ingestToken.create).not.toHaveBeenCalled();
    });
  });

  describe('issueServiceToken', () => {
    let serviceAccount = { ...consumer, id: 'con_sa', isServiceAccount: true };

    it('refuses an organization without the agent tracking flag and creates nothing', async () => {
      mocks.flagged.value = false;
      vi.mocked(db.instance.findUniqueOrThrow).mockResolvedValue(instance as any);

      await expect(
        agentTrackingTokenService.issueServiceToken({
          consumer: serviceAccount as any,
          instance: instance as any,
          input: { name: 'CI' }
        })
      ).rejects.toMatchObject({
        data: { status: 404, entity: 'agent_tracking.ingest_token' }
      });
      expect(mocks.withInstanceScope).not.toHaveBeenCalled();
      expect(mocks.agentTracking.ingestToken.create).not.toHaveBeenCalled();
      expect(db.agentTrackingIngestToken.create).not.toHaveBeenCalled();
    });

    it('issues an ephemeral-device token for a service account', async () => {
      vi.mocked(db.instance.findUniqueOrThrow).mockResolvedValue(instance as any);

      let result = await agentTrackingTokenService.issueServiceToken({
        consumer: serviceAccount as any,
        instance: instance as any,
        input: { name: 'CI', tags: [{ key: 'pipeline', value: 'deploy' }] }
      });

      expect(mocks.agentTracking.ingestToken.create).toHaveBeenCalledWith(
        {
          organizationId: 'org_1',
          instanceId: 'inst_1',
          name: 'CI',
          userRef: 'con_sa',
          deviceMode: 'ephemeral',
          tags: [{ key: 'pipeline', value: 'deploy' }],
          contentPolicy: { defaultMode: 'full' }
        },
        { timeoutMs: 5_000, retry: false }
      );
      expect(db.agentTrackingIngestToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ deviceMode: 'ephemeral', consumerOid: 10n })
      });

      await Promise.all(mocks.afterCommit.map(hook => hook()));

      expect(mocks.syncEntities).toHaveBeenCalledWith({
        entities: [{ type: 'consumer', id: 'con_sa' }]
      });
      expect(result.secret).toBe('metorial_agit_secret');
    });

    it('revokes a service token in the service when it cannot be stored', async () => {
      vi.mocked(db.instance.findUniqueOrThrow).mockResolvedValue(instance as any);
      vi.mocked(db.agentTrackingIngestToken.create).mockRejectedValueOnce(
        new Error('Database unavailable')
      );
      mocks.agentTracking.ingestToken.revoke.mockRejectedValueOnce(new Error('Service down'));

      await expect(
        agentTrackingTokenService.issueServiceToken({
          consumer: serviceAccount as any,
          instance: instance as any,
          input: { name: 'CI' }
        })
      ).rejects.toThrow('Database unavailable');

      expect(mocks.agentTracking.ingestToken.revoke).toHaveBeenCalledWith(
        { organizationId: 'org_1', ingestTokenId: 'git_new' },
        { timeoutMs: 3_000 }
      );
    });

    it('rejects consumers that are not service accounts', async () => {
      await expectServiceError(
        agentTrackingTokenService.issueServiceToken({
          consumer: consumer as any,
          instance: instance as any,
          input: { name: 'CI' }
        }),
        'Only service accounts can get ingest tokens without a device.'
      );
    });

    it('rejects an instance of another organization', async () => {
      await expectServiceError(
        agentTrackingTokenService.issueServiceToken({
          consumer: serviceAccount as any,
          instance: { ...instance, organizationOid: 99n } as any,
          input: { name: 'CI' }
        }),
        'The service account belongs to another organization.'
      );
    });
  });

  describe('revokeIngestToken', () => {
    it('revokes in agent tracking and marks the token revoked', async () => {
      vi.mocked(db.instance.findUniqueOrThrow).mockResolvedValue(instance as any);

      await agentTrackingTokenService.revokeIngestToken({
        ingestToken: {
          oid: 5n,
          status: 'active',
          instanceOid: 3n,
          serviceIngestTokenId: 'git_1'
        } as any
      });

      expect(mocks.agentTracking.ingestToken.revoke).toHaveBeenCalledWith({
        organizationId: 'org_1',
        ingestTokenId: 'git_1'
      });
      expect(db.agentTrackingIngestToken.update).toHaveBeenCalledWith({
        where: { oid: 5n },
        data: { status: 'revoked', revokedAt: expect.any(Date) }
      });
    });

    it('leaves an already revoked token alone', async () => {
      await agentTrackingTokenService.revokeIngestToken({
        ingestToken: { oid: 5n, status: 'revoked' } as any
      });

      expect(mocks.agentTracking.ingestToken.revoke).not.toHaveBeenCalled();
      expect(db.agentTrackingIngestToken.update).not.toHaveBeenCalled();
    });
  });
});
