import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  process.env.AGENT_TRACKING_URL = 'http://agent-tracking.internal/metorial-agent-tracking';
  process.env.AGENT_TRACKING_INGEST_PUBLIC_URL = 'https://ingest.example.com';
  process.env.METORIAL_ENABLED_FLAGS = 'agent-tracking-enabled';

  let calls: string[] = [];

  let rpcProxy = (path: string[]): any =>
    new Proxy(() => {}, {
      get: (_, prop) => rpcProxy([...path, String(prop)]),
      apply: async () => {
        calls.push(path.join(':'));
        return { id: `${path.join('_')}_1`, secret: 'metorial_agit_secret', expiresAt: null };
      }
    });

  return { calls, client: rpcProxy([]) };
});

vi.mock('@mtsrc/agent-tracking-client-internal', () => ({
  createAgentTrackingClient: () => mocks.client
}));

vi.mock('@metorial/queue', () => ({
  createQueue: () => ({
    add: vi.fn(),
    addMany: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  }),
  combineQueueProcessors: vi.fn(() => ({})),
  dailyPacedDelay: vi.fn(),
  hourlyPacedDelay: vi.fn(),
  pacedDelay: vi.fn()
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn(() => ({}))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: vi.fn(), fire: vi.fn() }
}));

vi.mock('@metorial/db', () => {
  let db = {
    $queryRaw: vi.fn(),
    consumerDevice: {
      findUniqueOrThrow: vi.fn(async () => ({
        oid: 20n,
        id: 'codv_1',
        status: 'active',
        name: "Ada's Mac",
        instance: {
          oid: 3n,
          id: 'inst_1',
          name: 'Default',
          organization: { oid: 1n, id: 'org_1', name: 'Acme' },
          project: { oid: 2n, id: 'proj_1', name: 'Production' }
        },
        consumerProfile: { consumer: { oid: 10n, id: 'con_1' } }
      }))
    },
    agentTrackingIngestToken: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }) => ({ oid: 1n, status: 'active', ...data }))
    },
    agentTrackingIngestSource: {
      create: vi.fn(async ({ data }) => ({ oid: 1n, status: 'active', ...data })),
      findUnique: vi.fn(async () => ({
        oid: 1n,
        id: 'atis_1',
        status: 'revoked',
        serviceIngestSourceId: 'atis_service_1',
        serviceRevokedAt: null,
        instance: { organization: { id: 'org_1' } }
      })),
      update: vi.fn(async ({ data }) => data)
    },
    agentTrackingOrganizationSettings: { findFirst: vi.fn(async () => null) },
    agentTrackingProjectSettings: { findFirst: vi.fn(async () => null) },
    agentTrackingInstanceSettings: { findFirst: vi.fn(async () => null) },
    organization: { findUnique: vi.fn(async () => null), updateMany: vi.fn() },
    project: { findUnique: vi.fn(async () => null), updateMany: vi.fn() },
    instance: { findUnique: vi.fn(async () => null), updateMany: vi.fn() }
  };

  return {
    db,
    ID: { generateId: vi.fn(async () => 'atit_1') },
    withTransaction: vi.fn(async (callback: (db: any) => unknown) => await callback(db)),
    addAfterTransactionHook: vi.fn()
  };
});

import { requireAgentTracking, withInstanceScope } from '@metorial/module-agent-tracking-sync';
import { revokeIngestSourceQueueProcessor } from '../src/queues/revokeIngestSources';
import { agentTrackingIngestSourceService } from '../src/services/agentTrackingIngestSource';
import { agentTrackingTokenService } from '../src/services/agentTrackingToken';

let settles = async (promise: Promise<unknown>) =>
  await Promise.race([
    promise.then(() => 'settled'),
    new Promise(resolve => setTimeout(() => resolve('pending'), 1000))
  ]);

describe('the agent-tracking client is never resolved through a promise', () => {
  beforeEach(() => {
    mocks.calls.length = 0;
  });

  it('requireAgentTracking hands out the client itself', () => {
    expect(requireAgentTracking()).toBe(mocks.client);
    expect(mocks.calls).toEqual([]);
  });

  it('withInstanceScope settles without calling then', async () => {
    let result = await settles(
      withInstanceScope(
        {
          organization: { oid: 1n, id: 'org_1', name: 'Acme' },
          project: { oid: 2n, id: 'proj_1', name: 'Production' },
          instance: { oid: 3n, id: 'inst_1', name: 'Default' }
        },
        async () => {}
      )
    );

    expect(result).toBe('settled');
    expect(mocks.calls).toEqual(['organization:upsert', 'project:upsert', 'instance:upsert']);
  });

  it('issueDeviceToken settles without calling then', async () => {
    let result = await settles(
      agentTrackingTokenService.issueDeviceToken({
        consumerDevice: { oid: 20n },
        auditScope: {} as any
      })
    );

    expect(result).toBe('settled');
    expect(mocks.calls).not.toContain('then');
    expect(mocks.calls).toContain('ingestToken:create');
  });

  it('createIngestSource settles without calling then', async () => {
    let result = await settles(
      agentTrackingIngestSourceService.createIngestSource({
        organization: { oid: 1n, id: 'org_1', name: 'Acme' } as any,
        project: { oid: 2n, id: 'proj_1', name: 'Production' } as any,
        instance: { oid: 3n, id: 'inst_1', name: 'Default' } as any,
        auditScope: {} as any,
        input: { name: 'Engineering laptops', clientFamily: 'claude_code' }
      })
    );

    expect(result).toBe('settled');
    expect(mocks.calls).not.toContain('then');
    expect(mocks.calls).toContain('ingestSource:create');
  });

  it('describeIngestSource settles without calling then', async () => {
    let result = await settles(
      agentTrackingIngestSourceService.describeIngestSource({
        ingestSource: {
          id: 'atis_1',
          serviceIngestSourceId: 'atis_service_1',
          instance: { organization: { id: 'org_1' } }
        } as any
      })
    );

    expect(result).toBe('settled');
    expect(mocks.calls).toEqual(['ingestSource:get']);
  });

  it('the service revoke job settles without calling then', async () => {
    let result = await settles(
      (revokeIngestSourceQueueProcessor as any).handler({ ingestSourceId: 'atis_1' })
    );

    expect(result).toBe('settled');
    expect(mocks.calls).toEqual(['ingestSource:revoke']);
  });
});
