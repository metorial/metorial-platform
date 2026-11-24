import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent, addAfterTransactionHook } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook())
}));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: { recordEvent }
}));

vi.mock('@metorial/db', () => ({ addAfterTransactionHook }));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: vi.fn() }
}));

import {
  recordAgentTrackingIngestSourceCreated,
  recordAgentTrackingIngestSourceRevoked,
  recordAgentTrackingSettingsUpdated,
  recordAgentTrackingViewCreated,
  recordAgentTrackingViewDeleted,
  recordAgentTrackingViewUpdated
} from './agentTracking';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: { ip: '127.0.0.1' }
};

let ingestSource = {
  oid: 7n,
  id: 'atis_1',
  status: 'active',
  serviceIngestSourceId: 'atis_service_1',
  name: 'Engineering laptops',
  clientFamily: 'claude_code',
  secretRedacted: 'metorial_agis_4eC3...p7dc',
  instanceOid: 3n,
  instance: { id: 'inst_1' },
  revokedAt: null,
  serviceRevokedAt: null,
  createdAt: new Date('2026-11-18T10:00:00Z'),
  updatedAt: new Date('2026-11-18T10:00:00Z')
};

let payloadFields = ['id', 'name', 'status', 'clientFamily', 'instanceId', 'revokedAt'];

describe('agent tracking ingest source audit listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordEvent.mockResolvedValue(undefined);
  });

  it('records creation with hand-picked fields and nothing secret', async () => {
    await recordAgentTrackingIngestSourceCreated({ ingestSource, auditScope } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'agent_tracking_ingest_source',
      'create',
      {
        payload: {
          id: 'atis_1',
          name: 'Engineering laptops',
          status: 'active',
          clientFamily: 'claude_code',
          instanceId: 'inst_1',
          revokedAt: null
        },
        recordedAt: expect.any(Date)
      }
    );

    let { payload } = recordEvent.mock.calls[0]![3];
    expect(Object.keys(payload).sort()).toEqual([...payloadFields].sort());
  });

  it('records revocation with the previous state', async () => {
    let revokedAt = new Date('2026-11-18T12:00:00Z');

    await recordAgentTrackingIngestSourceRevoked({
      ingestSource: { ...ingestSource, status: 'revoked', revokedAt },
      previousIngestSource: ingestSource,
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'agent_tracking_ingest_source',
      'revoke',
      expect.objectContaining({
        payload: expect.objectContaining({ status: 'revoked', revokedAt }),
        previousPayload: expect.objectContaining({ status: 'active', revokedAt: null })
      })
    );
  });
});

describe('agent tracking settings audit listener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordEvent.mockResolvedValue(undefined);
  });

  it('records the settings before and after an update', async () => {
    let previousSettings = {
      organizationId: 'org_1',
      privacy: { hideIndividuals: false, minGroupUsers: 5 }
    };
    let settings = {
      ...previousSettings,
      privacy: { hideIndividuals: true, minGroupUsers: 8 }
    };

    await recordAgentTrackingSettingsUpdated({
      settings,
      previousSettings,
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'agent_tracking_settings', 'update', {
      payload: settings,
      previousPayload: previousSettings,
      recordedAt: expect.any(Date)
    });
  });
});

describe('agent tracking view audit listeners', () => {
  let view = {
    oid: 9n,
    id: 'atvw_1',
    status: 'active',
    page: 'team',
    kind: 'practices',
    name: 'High effort',
    nameKey: 'high effort',
    params: { version: 1, range: 'last_30_days', high_effort_share_min: 0.5 },
    instanceOid: 3n,
    instance: { id: 'inst_1', organization: { id: 'org_1' } },
    creatorActorOid: 4n,
    creatorActor: { id: 'oac_1', email: 'admin@example.com', name: 'Admin' },
    deletedAt: null,
    createdAt: new Date('2026-11-22T10:00:00Z'),
    updatedAt: new Date('2026-11-22T10:00:00Z')
  };

  let payloadFields = [
    'id',
    'name',
    'status',
    'page',
    'kind',
    'params',
    'instanceId',
    'creatorActorId',
    'deletedAt'
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    recordEvent.mockResolvedValue(undefined);
  });

  it('records creation with hand-picked fields', async () => {
    await recordAgentTrackingViewCreated({ view, auditScope } as any);

    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'agent_tracking_view', 'create', {
      payload: {
        id: 'atvw_1',
        name: 'High effort',
        status: 'active',
        page: 'team',
        kind: 'practices',
        params: view.params,
        instanceId: 'inst_1',
        creatorActorId: 'oac_1',
        deletedAt: null
      },
      recordedAt: expect.any(Date)
    });

    let { payload } = recordEvent.mock.calls[0]![3];
    expect(Object.keys(payload).sort()).toEqual([...payloadFields].sort());
    expect(JSON.stringify(payload)).not.toContain('admin@example.com');
  });

  it('records an update with the previous state', async () => {
    await recordAgentTrackingViewUpdated({
      view: { ...view, name: 'Effort' },
      previousView: view,
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'agent_tracking_view',
      'update',
      expect.objectContaining({
        payload: expect.objectContaining({ name: 'Effort' }),
        previousPayload: expect.objectContaining({ name: 'High effort' })
      })
    );
  });

  it('records a deletion of a view whose creator is gone', async () => {
    let deletedAt = new Date('2026-11-22T12:00:00Z');

    await recordAgentTrackingViewDeleted({
      view: { ...view, status: 'deleted', deletedAt, nameKey: null, creatorActor: null },
      previousView: { ...view, creatorActor: null },
      auditScope
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'agent_tracking_view',
      'delete',
      expect.objectContaining({
        payload: expect.objectContaining({
          status: 'deleted',
          deletedAt,
          creatorActorId: null
        }),
        previousPayload: expect.objectContaining({ status: 'active', deletedAt: null })
      })
    );
  });
});
