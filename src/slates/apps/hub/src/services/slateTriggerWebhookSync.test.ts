import { describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({ db: {} }));
vi.mock('../env', () => ({ env: { slates: {} } }));
vi.mock('./slateTriggerReceiver', () => ({ slateTriggerReceiverService: {} }));
vi.mock('./slateTriggerWebhookAuthenticatedBoundary', () => ({
  authenticateReceiverRouteBoundary: vi.fn()
}));
vi.mock('./slateTriggerWebhookProcessing', () => ({
  finalizeWebhookRequest: vi.fn(),
  getSlateTriggerWebhookLock: vi.fn()
}));
vi.mock('./slateTriggerWebhookRequest', () => ({
  slateTriggerWebhookRequestService: {}
}));

import { db } from '../db';
import { getSyncCandidates, slateTriggerWebhookSyncService } from './slateTriggerWebhookSync';
import { actionVerificationDeclaration } from './slateTriggerRegistrationLifecycle';
import { slateTriggerReceiverService } from './slateTriggerReceiver';
import { authenticateReceiverRouteBoundary } from './slateTriggerWebhookAuthenticatedBoundary';
import {
  finalizeWebhookRequest,
  getSlateTriggerWebhookLock
} from './slateTriggerWebhookProcessing';
import { slateTriggerWebhookRequestService } from './slateTriggerWebhookRequest';

let trigger = (id: string, overrides: Record<string, unknown> = {}) => ({
  oid: BigInt(id.length),
  id,
  source: 'webhook',
  tombstonedAt: null,
  ingressDisabledAt: null,
  action: { id: `action-${id}`, spec: {} },
  ...overrides
});

describe('synchronous webhook target loading', () => {
  it('loads a receiver with only routable webhook trigger candidates', async () => {
    let receiver = {
      oid: 1n,
      id: 'receiver',
      status: 'active',
      triggers: [
        trigger('old-tombstoned', {
          tombstonedAt: new Date('2030-01-01T00:00:00.000Z')
        }),
        trigger('old-disabled', {
          ingressDisabledAt: new Date('2030-01-01T00:00:00.000Z')
        }),
        trigger('active-replacement')
      ]
    };
    let findFirst = vi.fn(async () => receiver);
    (db as any).slateTriggerReceiver = { findFirst };

    let target = await (slateTriggerWebhookSyncService as any).loadTarget({
      receiverId: receiver.id
    });

    expect(target.triggers.map((candidate: any) => candidate.id)).toEqual([
      'active-replacement'
    ]);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: receiver.id },
        include: expect.objectContaining({
          triggers: expect.objectContaining({
            where: {
              source: 'webhook',
              tombstonedAt: null,
              ingressDisabledAt: null
            }
          })
        })
      })
    );
  });

  it('fails an exact inactive trigger closed at the database query', async () => {
    let findFirst = vi.fn(async () => null);
    (db as any).slateTriggerReceiverTrigger = { findFirst };

    await expect(
      (slateTriggerWebhookSyncService as any).loadTarget({
        receiverTriggerId: 'inactive-trigger'
      })
    ).rejects.toThrow();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'inactive-trigger',
          source: 'webhook',
          tombstonedAt: null,
          ingressDisabledAt: null
        }
      })
    );
  });
});

let hmacRule = () => ({
  id: 'delivery.v1',
  phase: 'delivery',
  when: { methods: ['POST'] },
  verify: {
    type: 'raw_hmac',
    secretName: 'signing',
    algorithm: 'sha256',
    signature: {
      headerName: 'X-Signature',
      encoding: 'hex',
      duplicateHeaderPolicy: 'reject',
      multipleSignaturePolicy: 'reject'
    },
    message: [{ source: 'body' }]
  },
  result: { type: 'dispatch', scope: 'receiver_trigger' },
  replay: {
    kind: 'enforced',
    deduplicate: {
      source: 'header',
      headerName: 'X-Delivery-Id',
      ttlSeconds: 60,
      scope: 'request'
    }
  }
});

// No ingress/specHash -> resolves to path_secret_only.
let pathSecretOnlyTrigger = (id: string, syncMode: 'always' | 'match' | 'never') => ({
  id,
  oid: BigInt(id.length),
  action: {
    id: `action-${id}`,
    spec: {
      id: `action-${id}`,
      type: 'action.trigger',
      invocation: {
        type: 'webhook',
        autoRegistration: false,
        autoUnregistration: false,
        http: { methods: ['POST'], sync: { mode: syncMode } }
      }
    }
  } as any
});

// Hub-verified trigger that also declares http.sync (the bypass combination).
let hubVerifiedTrigger = (id: string) => ({
  id,
  oid: BigInt(id.length),
  action: {
    id: `action-${id}`,
    spec: {
      id: `action-${id}`,
      type: 'action.trigger',
      capabilities: { webhookInboundVerificationV1: true },
      invocation: {
        type: 'webhook',
        autoRegistration: false,
        autoUnregistration: false,
        http: {
          methods: ['POST'],
          sync: { mode: 'always' },
          ingress: {
            kind: 'receiver_route',
            baseline: 'receiver_path_secret',
            verification: {
              mechanism: 'hub',
              baseline: 'receiver_path_secret',
              allowedSecretRefs: [
                {
                  name: 'signing',
                  source: 'config',
                  configKey: 'webhookSigningSecret',
                  encoding: 'utf8'
                }
              ],
              rules: [hmacRule()]
            }
          }
        }
      },
      specHash: 'a'.repeat(64)
    }
  } as any
});

let hubSyncOnlyTrigger = (id: string) => {
  let trigger = hubVerifiedTrigger(id);
  trigger.action.spec.invocation.http.ingress.verification.rules[0].phase = 'bootstrap';
  trigger.action.spec.invocation.http.ingress.verification.rules[0].result = {
    type: 'sync_only'
  };
  trigger.action.spec.invocation.http.ingress.verification.rules[0].replay = {
    kind: 'not_applicable',
    reason: 'bootstrap_sync_only'
  };
  trigger.action.spec.invocation.http.ingress.verification.rules[0].verify = {
    type: 'preset',
    preset: 'slack.v0'
  };
  return trigger;
};

describe('synchronous webhook candidate selection', () => {
  it('treats the constructed fixtures as the mechanisms they claim', () => {
    // Fixture guard: a malformed hub http shape would fall back to path_secret_only and mask a regression.
    expect(actionVerificationDeclaration(pathSecretOnlyTrigger('pss', 'always').action).mechanism)
      .toBe('path_secret_only');
    expect(actionVerificationDeclaration(hubVerifiedTrigger('hub').action).mechanism).toBe('hub');
  });

  it('includes path_secret_only sync triggers as inline candidates', () => {
    let candidates = getSyncCandidates([pathSecretOnlyTrigger('pss', 'always')], 'POST');
    expect(candidates.map(candidate => candidate.id)).toEqual(['pss']);
    expect(candidates[0]?.kind).toBe('legacy_path');
  });

  it('excludes hub-verified triggers so their signatures are checked by the async pipeline', () => {
    let candidates = getSyncCandidates([hubVerifiedTrigger('hub')], 'POST');
    expect(candidates).toEqual([]);
  });

  it('includes only explicit Hub sync_only rules in the exact inline path', () => {
    let candidates = getSyncCandidates([hubSyncOnlyTrigger('hub-sync')], 'POST');
    expect(candidates.map(candidate => ({ id: candidate.id, kind: candidate.kind }))).toEqual([
      { id: 'hub-sync', kind: 'hub_exact' }
    ]);
  });

  it('exposes mixed legacy and exact authorities for fail-closed conflict handling', () => {
    let candidates = getSyncCandidates(
      [hubSyncOnlyTrigger('hub'), pathSecretOnlyTrigger('pss', 'always')],
      'POST'
    );
    expect(candidates.map(candidate => candidate.kind)).toEqual(['hub_exact', 'legacy_path']);
  });
});

describe('authenticated exact synchronous orchestration', () => {
  it('returns the Hub response instead of queued JSON', async () => {
    let receiverTrigger = hubSyncOnlyTrigger('hub-sync') as any;
    receiverTrigger.source = 'webhook';
    receiverTrigger.tombstonedAt = null;
    receiverTrigger.ingressDisabledAt = null;
    receiverTrigger.receiver = {
      id: 'receiver',
      status: 'active',
      tenant: { id: 'tenant' }
    };
    (db as any).slateTriggerReceiverTrigger = {
      findFirst: vi.fn(async () => receiverTrigger)
    };
    vi.mocked(authenticateReceiverRouteBoundary).mockResolvedValue({} as any);
    Object.assign(slateTriggerWebhookRequestService as any, {
      createCapturedWebhookRequest: vi.fn(async () => ({
        id: 'request',
        receiverTriggerId: receiverTrigger.id,
        receiverId: null,
        url: 'https://hooks.test/slack',
        method: 'POST',
        headers: {},
        createdAt: new Date()
      })),
      claimSyncOwnership: vi.fn(async () => true),
      prepareQueueTakeover: vi.fn(async () => true),
      enqueueWebhookRequest: vi.fn(async () => undefined),
      ownsSyncContinuation: vi.fn(async () => true),
      enterSyncCommit: vi.fn(async () => true),
      completeSyncTriggerCommit: vi.fn(async () => true)
    });
    Object.assign(slateTriggerReceiverService as any, {
      handleCapturedTriggerWebhook: vi.fn(async () => ({
          status: 'committed',
          response: {
            status: 200,
            headers: [['content-type', 'text/plain; charset=utf-8']],
            body: {
              present: true,
              base64: Buffer.from('challenge').toString('base64')
            }
          }
        }))
    });
    vi.mocked(getSlateTriggerWebhookLock).mockReturnValue({
      usingLock: async (_key: string, callback: () => Promise<unknown>) => await callback()
    } as any);
    vi.mocked(finalizeWebhookRequest).mockResolvedValue(true);

    let result = await slateTriggerWebhookSyncService.handleWebhookRequest({
      receiverTriggerId: receiverTrigger.id,
      request: {
        url: 'https://hooks.test/slack',
        method: 'POST',
        headers: [['content-type', 'application/json']],
        body: {
          present: true,
          base64: Buffer.from('{"type":"url_verification"}').toString('base64')
        }
      },
      pathSecret: 'receiver-secret',
      capturePolicy: {} as any
    });

    expect(result).toEqual({
      type: 'response',
      webhookRequestId: 'request',
      response: {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: {
          encoding: 'base64',
          content: Buffer.from('challenge').toString('base64')
        }
      }
    });
    expect((slateTriggerReceiverService as any).handleCapturedTriggerWebhook).toHaveBeenCalledOnce();
    expect((slateTriggerWebhookRequestService as any).enqueueWebhookRequest).not.toHaveBeenCalled();
    expect(finalizeWebhookRequest).toHaveBeenCalledOnce();
  });
});
