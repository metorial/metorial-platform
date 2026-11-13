import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  groundstation: {
    organization: { upsert: vi.fn() },
    project: { upsert: vi.fn() },
    instance: { upsert: vi.fn() },
    ingestToken: { create: vi.fn(), revoke: vi.fn() }
  },
  enabled: { value: true },
  settings: {
    groundstationIngestPublicUrl: 'https://ingest.example.com' as string | undefined
  },
  afterCommit: [] as (() => unknown)[],
  revokeAddManyWithOps: vi.fn(),
  syncEntityAdd: vi.fn(),
  syncEntityAddMany: vi.fn(),
  fire: vi.fn()
}));

vi.mock('@metorial/db', () => {
  let db = {
    consumerDevice: { findUniqueOrThrow: vi.fn() },
    instance: { findUniqueOrThrow: vi.fn() },
    agentTelemetryIngestToken: {
      findMany: vi.fn(),
      create: vi.fn(async ({ data }) => ({ oid: 1n, status: 'active', ...data })),
      update: vi.fn(async ({ data }) => data)
    }
  };

  return {
    db,
    ID: { generateId: vi.fn(async () => 'atit_1') },
    withTransaction: vi.fn(async (callback: (db: any) => unknown) => await callback(db)),
    addAfterTransactionHook: vi.fn((hook: () => unknown) => mocks.afterCommit.push(hook))
  };
});

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fire }
}));

vi.mock('../src/env', () => ({
  agentTelemetrySettings: mocks.settings
}));

vi.mock('../src/internal/groundstation', () => ({
  isAgentTelemetryEnabled: () => mocks.enabled.value,
  getGroundstation: () => (mocks.enabled.value ? mocks.groundstation : null),
  ignoreNotFound: (promise: Promise<unknown>) => promise
}));

vi.mock('../src/queues/revokeTokens', () => ({
  revokeIngestTokenQueue: { addManyWithOps: mocks.revokeAddManyWithOps }
}));

vi.mock('../src/queues/syncEntity', () => ({
  syncEntityQueue: { add: mocks.syncEntityAdd, addMany: mocks.syncEntityAddMany }
}));

import { db } from '@metorial/db';
import { agentTelemetryTokenService } from '../src/services/agentTelemetryToken';

let organization = { oid: 1n, id: 'org_1', name: 'Acme' };
let project = { oid: 2n, id: 'proj_1', name: 'Production' };
let instance = {
  oid: 3n,
  id: 'inst_1',
  name: 'Default',
  organizationOid: 1n,
  organization,
  project
};
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

let expectServiceError = async (promise: Promise<unknown>, message: string) => {
  await expect(promise).rejects.toMatchObject({ data: { message } });
};

describe('agentTelemetryTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
    mocks.settings.groundstationIngestPublicUrl = 'https://ingest.example.com';
    mocks.afterCommit = [];
    mocks.groundstation.ingestToken.create.mockResolvedValue({
      id: 'git_new',
      secret: 'metorial_agit_secret',
      expiresAt: null
    });
  });

  describe('canIssueDeviceTokens', () => {
    it('needs both Groundstation and the public ingest URL', async () => {
      expect(await agentTelemetryTokenService.canIssueDeviceTokens()).toBe(true);

      mocks.settings.groundstationIngestPublicUrl = undefined;
      expect(await agentTelemetryTokenService.canIssueDeviceTokens()).toBe(false);

      mocks.settings.groundstationIngestPublicUrl = 'https://ingest.example.com';
      mocks.enabled.value = false;
      expect(await agentTelemetryTokenService.canIssueDeviceTokens()).toBe(false);
    });
  });

  describe('issueDeviceToken', () => {
    it('binds a token to the consumer and device on the device instance', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);
      vi.mocked(db.agentTelemetryIngestToken.findMany).mockResolvedValue([]);

      let result = await agentTelemetryTokenService.issueDeviceToken({
        consumerDevice: { oid: 20n },
        auditScope
      });

      expect(mocks.groundstation.instance.upsert).toHaveBeenCalledWith({
        organizationId: 'org_1',
        projectId: 'proj_1',
        ref: 'inst_1',
        name: 'Default'
      });
      expect(mocks.groundstation.ingestToken.create).toHaveBeenCalledWith({
        organizationId: 'org_1',
        instanceId: 'inst_1',
        name: "Ada's Mac",
        userRef: 'con_1',
        deviceRef: 'codv_1',
        deviceMode: 'bound'
      });
      expect(db.agentTelemetryIngestToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceMode: 'bound',
          groundstationIngestTokenId: 'git_new',
          consumerOid: 10n,
          consumerDeviceOid: 20n,
          instanceOid: 3n
        })
      });
      expect(result).toMatchObject({
        secret: 'metorial_agit_secret',
        ingestUrl: 'https://ingest.example.com',
        expiresAt: null,
        ingestToken: { id: 'atit_1', groundstationIngestTokenId: 'git_new' }
      });
      expect(mocks.syncEntityAddMany).toHaveBeenCalledWith([
        { type: 'consumer', id: 'con_1' },
        { type: 'device', id: 'codv_1' }
      ]);
    });

    it('fires the created event without the secret', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(createDevice() as any);
      vi.mocked(db.agentTelemetryIngestToken.findMany).mockResolvedValue([]);

      await agentTelemetryTokenService.issueDeviceToken({
        consumerDevice: { oid: 20n },
        auditScope
      });

      expect(mocks.fire).toHaveBeenCalledWith('agent_telemetry.ingest_token.created:after', {
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
      vi.mocked(db.agentTelemetryIngestToken.findMany).mockResolvedValue([
        { id: 'atit_old' }
      ] as any);

      await agentTelemetryTokenService.issueDeviceToken({
        consumerDevice: { oid: 20n },
        auditScope
      });

      expect(mocks.revokeAddManyWithOps).not.toHaveBeenCalled();
      expect(mocks.fire).toHaveBeenCalledWith(
        'agent_telemetry.ingest_token.created:after',
        expect.objectContaining({ replacedIngestTokenIds: ['atit_old'] })
      );

      await Promise.all(mocks.afterCommit.map(hook => hook()));

      expect(mocks.revokeAddManyWithOps).toHaveBeenCalledWith([
        { data: { ingestTokenId: 'atit_old' }, opts: { id: 'atit_old' } }
      ]);
    });

    it('rejects a device that is no longer signed in', async () => {
      vi.mocked(db.consumerDevice.findUniqueOrThrow).mockResolvedValue(
        createDevice({ status: 'revoked' }) as any
      );

      await expectServiceError(
        agentTelemetryTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        }),
        'This device is no longer signed in.'
      );
      expect(mocks.groundstation.ingestToken.create).not.toHaveBeenCalled();
    });

    it('rejects while Groundstation is not configured', async () => {
      mocks.enabled.value = false;

      await expectServiceError(
        agentTelemetryTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        }),
        'Agent telemetry is not configured.'
      );
      expect(db.consumerDevice.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('rejects while the public ingest URL is not configured', async () => {
      mocks.settings.groundstationIngestPublicUrl = undefined;

      await expectServiceError(
        agentTelemetryTokenService.issueDeviceToken({
          consumerDevice: { oid: 20n },
          auditScope
        }),
        'Agent telemetry is not configured.'
      );
      expect(mocks.groundstation.ingestToken.create).not.toHaveBeenCalled();
    });
  });

  describe('issueServiceToken', () => {
    let serviceAccount = { ...consumer, id: 'con_sa', isServiceAccount: true };

    it('issues an ephemeral-device token for a service account', async () => {
      vi.mocked(db.instance.findUniqueOrThrow).mockResolvedValue(instance as any);

      let result = await agentTelemetryTokenService.issueServiceToken({
        consumer: serviceAccount as any,
        instance: instance as any,
        input: { name: 'CI', tags: [{ key: 'pipeline', value: 'deploy' }] }
      });

      expect(mocks.groundstation.ingestToken.create).toHaveBeenCalledWith({
        organizationId: 'org_1',
        instanceId: 'inst_1',
        name: 'CI',
        userRef: 'con_sa',
        deviceMode: 'ephemeral',
        tags: [{ key: 'pipeline', value: 'deploy' }]
      });
      expect(db.agentTelemetryIngestToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ deviceMode: 'ephemeral', consumerOid: 10n })
      });
      expect(result.secret).toBe('metorial_agit_secret');
    });

    it('rejects consumers that are not service accounts', async () => {
      await expectServiceError(
        agentTelemetryTokenService.issueServiceToken({
          consumer: consumer as any,
          instance: instance as any,
          input: { name: 'CI' }
        }),
        'Only service accounts can get ingest tokens without a device.'
      );
    });

    it('rejects an instance of another organization', async () => {
      await expectServiceError(
        agentTelemetryTokenService.issueServiceToken({
          consumer: serviceAccount as any,
          instance: { ...instance, organizationOid: 99n } as any,
          input: { name: 'CI' }
        }),
        'The service account belongs to another organization.'
      );
    });
  });

  describe('revokeIngestToken', () => {
    it('revokes in Groundstation and marks the token revoked', async () => {
      vi.mocked(db.instance.findUniqueOrThrow).mockResolvedValue(instance as any);

      await agentTelemetryTokenService.revokeIngestToken({
        ingestToken: {
          oid: 5n,
          status: 'active',
          instanceOid: 3n,
          groundstationIngestTokenId: 'git_1'
        } as any
      });

      expect(mocks.groundstation.ingestToken.revoke).toHaveBeenCalledWith({
        organizationId: 'org_1',
        ingestTokenId: 'git_1'
      });
      expect(db.agentTelemetryIngestToken.update).toHaveBeenCalledWith({
        where: { oid: 5n },
        data: { status: 'revoked', revokedAt: expect.any(Date) }
      });
    });

    it('leaves an already revoked token alone', async () => {
      await agentTelemetryTokenService.revokeIngestToken({
        ingestToken: { oid: 5n, status: 'revoked' } as any
      });

      expect(mocks.groundstation.ingestToken.revoke).not.toHaveBeenCalled();
      expect(db.agentTelemetryIngestToken.update).not.toHaveBeenCalled();
    });
  });
});
