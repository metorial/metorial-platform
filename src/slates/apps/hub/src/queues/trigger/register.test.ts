import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  triggerFindUnique: vi.fn(),
  triggerFindMany: vi.fn(),
  triggerUpdateMany: vi.fn(),
  registerAddMany: vi.fn(),
  unregisterAddMany: vi.fn(),
  retiringCleanupAddMany: vi.fn(),
  registerHandler: undefined as undefined | ((data: unknown) => Promise<void>),
  unregisterHandler: undefined as undefined | ((data: unknown) => Promise<void>),
  serviceRegister: vi.fn(),
  serviceUnregister: vi.fn(),
  serviceRetiringCleanup: vi.fn(),
  metricAdd: vi.fn(),
  outboxFindMany: vi.fn(),
  outboxUpdateMany: vi.fn(),
  receiverFindMany: vi.fn(),
  receiverDeleteMany: vi.fn(),
  transaction: vi.fn(),
  resolveRegistrationDetails: vi.fn(),
  cleanupExpiredRegistrationSecrets: vi.fn()
}));

vi.mock('@lowerdeck/telemetry', async importOriginal => ({
  ...(await importOriginal<typeof import('@lowerdeck/telemetry')>()),
  metrics: {
    getMeter: () => ({ createCounter: () => ({ add: state.metricAdd }) })
  }
}));

vi.mock('../../db', () => ({
  db: {
    $transaction: state.transaction,
    slateTriggerReceiverTrigger: {
      findUnique: state.triggerFindUnique,
      findMany: state.triggerFindMany,
      updateMany: state.triggerUpdateMany
    },
    slateTriggerRegistrationOutbox: {
      findMany: state.outboxFindMany,
      updateMany: state.outboxUpdateMany
    },
    slateTriggerReceiver: {
      findMany: state.receiverFindMany,
      deleteMany: state.receiverDeleteMany
    }
  }
}));
vi.mock('../../services/slateTriggerReceiverSecret', () => ({
  slateTriggerReceiverSecretService: {
    resolveRegistrationDetails: state.resolveRegistrationDetails,
    cleanupExpiredRegistrationSecrets: state.cleanupExpiredRegistrationSecrets
  }
}));
vi.mock('../../services/slateTriggerReceiver', () => ({
  slateTriggerReceiverService: {
    registerWebhookForReceiverTriggerId: state.serviceRegister,
    unregisterWebhookForReceiverTriggerId: state.serviceUnregister,
    cleanupRetiringWebhookRegistration: state.serviceRetiringCleanup
  }
}));
vi.mock('./eventQueues', () => ({
  slateTriggerWebhookRegisterQueue: {
    process: (handler: (data: unknown) => Promise<void>) => {
      state.registerHandler = handler;
      return { name: 'register' };
    },
    addManyWithOps: state.registerAddMany
  },
  slateTriggerWebhookUnregisterQueue: {
    process: (handler: (data: unknown) => Promise<void>) => {
      state.unregisterHandler = handler;
      return { name: 'unregister' };
    },
    addManyWithOps: state.unregisterAddMany
  },
  slateTriggerWebhookRetiringCleanupQueue: {
    process: vi.fn(() => ({ name: 'retiring-cleanup' })),
    addManyWithOps: state.retiringCleanupAddMany
  },
  slateTriggerWebhookRegistrationRepairQueue: {
    process: vi.fn(() => ({ name: 'repair' })),
    add: vi.fn()
  },
  slateTriggerReceiverFinalCleanupQueue: {
    process: vi.fn(() => ({ name: 'final-cleanup' })),
    add: vi.fn()
  }
}));

import {
  beginRegistrationIntentInTransaction,
  registrationJobId,
  registrationQueueMetrics,
  safeRegistrationFailure,
  slateTriggerRegistrationLifecycleService
} from '../../services/slateTriggerRegistrationLifecycle';
import {
  finalizeTruthfulTriggerReceiverCleanup,
  repairWebhookRegistrationScheduling,
  scheduleExpiringWebhookRenewals,
  TRIGGER_RECEIVER_FINAL_RETENTION_MS
} from './register';

let row = (overrides: Record<string, unknown> = {}) => ({
  registrationGeneration: 5,
  registrationTransitionVersion: 2,
  registrationIntentKind: 'register',
  registrationStatus: 'pending',
  registrationLeaseExpiresAt: null,
  ...overrides
});

describe('truthful webhook registration queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.triggerFindUnique.mockResolvedValue(row());
    state.triggerUpdateMany.mockResolvedValue({ count: 1 });
    state.triggerFindMany.mockResolvedValue([]);
    state.outboxFindMany.mockResolvedValue([]);
    state.outboxUpdateMany.mockResolvedValue({ count: 1 });
    state.receiverFindMany.mockResolvedValue([]);
    state.receiverDeleteMany.mockResolvedValue({ count: 0 });
    state.registerAddMany.mockResolvedValue({});
    state.unregisterAddMany.mockResolvedValue({});
    state.serviceRegister.mockResolvedValue(undefined);
    state.serviceUnregister.mockResolvedValue(undefined);
    state.cleanupExpiredRegistrationSecrets.mockResolvedValue({ count: 0 });
    state.transaction.mockImplementation(
      async callback =>
        await callback({
          slateTriggerReceiverTrigger: {
            findUniqueOrThrow: vi.fn(async ({ where }: any) => ({
              oid: where.id === 'google' ? 1n : 2n,
              registrationGeneration: 4,
              registrationTransitionVersion: 2
            })),
            updateMany: vi.fn(async () => ({ count: 1 }))
          },
          slateTriggerRegistrationOutbox: {
            create: vi.fn(async ({ data }: any) => data)
          }
        })
    );
  });

  it('schedules Google and Word renewals before expiry and cleans expired overlap secrets', async () => {
    let now = new Date('2026-08-15T12:00:00.000Z');
    state.triggerFindMany.mockResolvedValueOnce([
      { id: 'google', registrationGeneration: 4, registrationVersion: 7 },
      { id: 'word', registrationGeneration: 5, registrationVersion: 8 },
      { id: 'later', registrationGeneration: 6, registrationVersion: 9 }
    ]);
    state.resolveRegistrationDetails.mockImplementation(async ({ receiverTriggerId }) =>
      receiverTriggerId === 'google'
        ? {
            expiration: String(now.getTime() + 10 * 60 * 1000),
            retiringValidUntil: String(now.getTime() - 1)
          }
        : receiverTriggerId === 'word'
          ? { expirationDateTime: new Date(now.getTime() + 20 * 60 * 1000).toISOString() }
          : { expiration: String(now.getTime() + 2 * 60 * 60 * 1000) }
    );

    await expect(scheduleExpiringWebhookRenewals({ now })).resolves.toEqual({
      scanned: 3,
      scheduled: 2,
      cleanupScheduled: 1,
      failed: 0
    });
    expect(state.transaction).toHaveBeenCalledTimes(2);
    expect(state.cleanupExpiredRegistrationSecrets).toHaveBeenCalledWith({ now });
    expect(state.retiringCleanupAddMany).toHaveBeenCalledWith([
      {
        data: {
          receiverTriggerId: 'google',
          registrationGeneration: 4,
          registrationVersion: 7
        },
        opts: { id: 'retiring-cleanup:google:4:7' }
      }
    ]);
  });

  it('cursor-paginates and inspects encrypted expiry for more than one thousand triggers', async () => {
    let rows = Array.from({ length: 1_005 }, (_, index) => ({
      id: `trigger-${String(index).padStart(4, '0')}`,
      registrationGeneration: 2,
      registrationVersion: 3
    }));
    let findMany = vi.fn(async ({ cursor, skip, take }: any) => {
      let start = cursor ? rows.findIndex(row => row.id === cursor.id) + (skip ?? 0) : 0;
      return rows.slice(start, start + take);
    });
    state.resolveRegistrationDetails.mockResolvedValue({
      expiration: String(new Date('2030-01-01T00:00:00.000Z').getTime())
    });
    await expect(
      scheduleExpiringWebhookRenewals({
        now: new Date('2026-08-15T12:00:00.000Z'),
        batchSize: 1_000,
        store: {
          slateTriggerReceiverTrigger: { findMany },
          $transaction: state.transaction
        } as never
      })
    ).resolves.toEqual({
      scanned: 1_005,
      scheduled: 0,
      cleanupScheduled: 0,
      failed: 0
    });
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(state.resolveRegistrationDetails).toHaveBeenCalledTimes(1_005);
  });

  it('continues after a mid-page decrypt failure and sees rows appended beyond the cursor', async () => {
    let rows = ['a', 'b', 'c'].map(id => ({
      id,
      registrationGeneration: 2,
      registrationVersion: 3
    }));
    let firstPage = true;
    let findMany = vi.fn(async ({ cursor, skip, take }: any) => {
      let start = cursor ? rows.findIndex(row => row.id === cursor.id) + (skip ?? 0) : 0;
      let page = rows.slice(start, start + take);
      if (firstPage) {
        firstPage = false;
        rows.push({ id: 'd', registrationGeneration: 2, registrationVersion: 3 });
      }
      return page;
    });
    state.resolveRegistrationDetails.mockImplementation(async ({ receiverTriggerId }) => {
      if (receiverTriggerId === 'b') throw new Error('injected decrypt failure');
      return { expiration: String(new Date('2030-01-01T00:00:00.000Z').getTime()) };
    });
    await expect(
      scheduleExpiringWebhookRenewals({
        now: new Date('2026-08-15T12:00:00.000Z'),
        batchSize: 2,
        store: {
          slateTriggerReceiverTrigger: { findMany },
          $transaction: state.transaction
        } as never
      })
    ).resolves.toEqual({
      scanned: 4,
      scheduled: 0,
      cleanupScheduled: 0,
      failed: 1
    });
    state.resolveRegistrationDetails.mockResolvedValue({
      expiration: String(new Date('2030-01-01T00:00:00.000Z').getTime())
    });
    await expect(
      scheduleExpiringWebhookRenewals({
        now: new Date('2026-08-15T12:01:00.000Z'),
        batchSize: 2,
        store: {
          slateTriggerReceiverTrigger: { findMany },
          $transaction: state.transaction
        } as never
      })
    ).resolves.toMatchObject({ scanned: 4, failed: 0 });
  });

  it('claims the exact generation and transition before provider work', async () => {
    let now = new Date('2026-08-14T12:00:00.000Z');
    await expect(
      slateTriggerRegistrationLifecycleService.claim({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 5,
        operation: 'register',
        now
      })
    ).resolves.toEqual({
      receiverTriggerId: 'trigger-1',
      registrationGeneration: 5,
      registrationTransitionVersion: 3,
      registrationLeaseToken: expect.any(String),
      registrationLeaseExpiresAt: new Date('2026-08-14T12:02:00.000Z'),
      intent: 'register',
      status: 'registering'
    });
    expect(state.triggerUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'trigger-1',
        registrationGeneration: 5,
        registrationTransitionVersion: 2,
        registrationStatus: 'pending'
      },
      data: expect.objectContaining({
        registrationStatus: 'registering',
        registrationTransitionVersion: 3,
        registrationLastAttemptAt: now
      })
    });
  });

  it.each(['register', 'reregister', 'renew'] as const)(
    'commits exactly one new generation in pending for %s intent',
    async intent => {
      let tx = {
        slateTriggerReceiverTrigger: {
          findUniqueOrThrow: vi.fn(async () => ({
            oid: 1n,
            registrationGeneration: 5,
            registrationTransitionVersion: 8
          })),
          updateMany: vi.fn(async () => ({ count: 1 }))
        },
        slateTriggerRegistrationOutbox: {
          create: vi.fn(async ({ data }: any) => data)
        }
      } as any;
      await expect(
        beginRegistrationIntentInTransaction({
          tx,
          receiverTriggerId: 'trigger-1',
          intent,
          now: new Date('2026-08-14T12:00:00.000Z')
        })
      ).resolves.toEqual({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 6,
        intent,
        outboxId: expect.any(String)
      });
      expect(tx.slateTriggerReceiverTrigger.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            oid: 1n,
            registrationGeneration: 5,
            registrationTransitionVersion: 8
          },
          data: expect.objectContaining({
            registrationGeneration: 6,
            registrationTransitionVersion: 0,
            registrationStatus: 'pending',
            registrationIntentKind: intent
          })
        })
      );
    }
  );

  it.each(['unregister', 'delete'] as const)(
    'commits exactly one new generation in unregistering for %s intent',
    async intent => {
      let tx = {
        slateTriggerReceiverTrigger: {
          findUniqueOrThrow: vi.fn(async () => ({
            oid: 1n,
            registrationGeneration: 5,
            registrationTransitionVersion: 8
          })),
          updateMany: vi.fn(async () => ({ count: 1 }))
        },
        slateTriggerRegistrationOutbox: {
          create: vi.fn(async ({ data }: any) => data)
        }
      } as any;
      await expect(
        beginRegistrationIntentInTransaction({
          tx,
          receiverTriggerId: 'trigger-1',
          intent,
          tombstone: intent === 'delete',
          now: new Date('2026-08-14T12:00:00.000Z')
        })
      ).resolves.toEqual({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 6,
        intent,
        outboxId: expect.any(String)
      });
      expect(tx.slateTriggerReceiverTrigger.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            registrationGeneration: 6,
            registrationTransitionVersion: 0,
            registrationStatus: 'unregistering',
            registrationIntentKind: intent,
            ...(intent === 'delete'
              ? {
                  tombstonedAt: new Date('2026-08-14T12:00:00.000Z'),
                  ingressDisabledAt: new Date('2026-08-14T12:00:00.000Z')
                }
              : {})
          })
        })
      );
    }
  );

  it('discards stale and legacy generation-less jobs before provider work', async () => {
    await state.registerHandler?.({ receiverTriggerId: 'trigger-1' });
    expect(state.serviceRegister).not.toHaveBeenCalled();
    state.triggerFindUnique.mockResolvedValueOnce(row({ registrationGeneration: 6 }));
    await expect(
      slateTriggerRegistrationLifecycleService.claim({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 5,
        operation: 'register'
      })
    ).resolves.toBeNull();
    expect(state.metricAdd).toHaveBeenCalledTimes(2);
  });

  it('persists a closed failure only for the still-owned generation/version', async () => {
    await expect(
      slateTriggerRegistrationLifecycleService.fail({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 5,
        registrationTransitionVersion: 3,
        registrationLeaseToken: 'lease-1',
        registrationLeaseExpiresAt: new Date('2026-08-14T12:02:00.000Z'),
        intent: 'register',
        status: 'registering',
        code: 'provider_timeout',
        now: new Date('2026-08-14T12:01:00.000Z')
      })
    ).resolves.toBe(true);
    expect(state.triggerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          registrationGeneration: 5,
          registrationTransitionVersion: 3,
          registrationStatus: 'registering',
          registrationLeaseToken: 'lease-1',
          registrationLeaseExpiresAt: { gt: expect.any(Date) }
        }),
        data: expect.objectContaining({
          registrationStatus: 'failed',
          registrationErrorCode: 'provider_timeout',
          registrationErrorMessage: 'The provider registration request timed out.'
        })
      })
    );
  });

  it('commits matching success and discards a stale provider result', async () => {
    await expect(
      slateTriggerRegistrationLifecycleService.succeed({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 5,
        registrationTransitionVersion: 3,
        registrationLeaseToken: 'lease-1',
        registrationLeaseExpiresAt: new Date('2026-08-14T12:02:00.000Z'),
        intent: 'register',
        status: 'registering',
        remoteRegistrationKnown: true
      })
    ).resolves.toBe(true);
    expect(state.triggerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'trigger-1',
          registrationGeneration: 5,
          registrationTransitionVersion: 3,
          registrationStatus: 'registering',
          registrationLeaseToken: 'lease-1',
          registrationLeaseExpiresAt: { gt: expect.any(Date) }
        },
        data: expect.objectContaining({
          registrationStatus: 'registered',
          remoteRegistrationKnown: true
        })
      })
    );

    state.triggerUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      slateTriggerRegistrationLifecycleService.succeed({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 5,
        registrationTransitionVersion: 3,
        registrationLeaseToken: 'lease-1',
        registrationLeaseExpiresAt: new Date('2026-08-14T12:02:00.000Z'),
        intent: 'register',
        status: 'registering',
        remoteRegistrationKnown: true
      })
    ).resolves.toBe(false);
  });

  it('repairs commit-before-enqueue and expired attempts with operation/generation job ids', async () => {
    state.triggerFindMany.mockResolvedValue([
      {
        id: 'register-trigger',
        registrationGeneration: 7,
        registrationTransitionVersion: 0,
        registrationIntentKind: 'renew'
      },
      {
        id: 'delete-trigger',
        registrationGeneration: 9,
        registrationTransitionVersion: 4,
        registrationIntentKind: 'delete'
      }
    ]);
    await expect(
      repairWebhookRegistrationScheduling({ now: new Date('2026-08-14T12:00:00.000Z') })
    ).resolves.toEqual({ scanned: 2, register: 1, unregister: 1 });
    expect(state.registerAddMany).toHaveBeenCalledWith([
      {
        data: { receiverTriggerId: 'register-trigger', registrationGeneration: 7 },
        opts: { id: 'renew:register-trigger:7:repair:0' }
      }
    ]);
    expect(state.unregisterAddMany).toHaveBeenCalledWith([
      {
        data: { receiverTriggerId: 'delete-trigger', registrationGeneration: 9 },
        opts: { id: 'delete:delete-trigger:9:repair:4' }
      }
    ]);
    expect(
      registrationJobId({
        operation: 'reregister',
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 12
      })
    ).toBe('reregister:trigger-1:12');
  });

  it('requires an unexpired lease for renewal and result ownership', async () => {
    state.triggerUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      slateTriggerRegistrationLifecycleService.renewLease({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 5,
        registrationTransitionVersion: 3,
        registrationLeaseToken: 'lease-1',
        registrationLeaseExpiresAt: new Date('2026-08-14T12:02:00.000Z'),
        intent: 'register',
        status: 'registering',
        now: new Date('2026-08-14T12:00:00.000Z')
      })
    ).resolves.toBe(false);
    expect(state.triggerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          registrationLeaseExpiresAt: { gt: expect.any(Date) }
        })
      })
    );
  });

  it('does not duplicate an active unregister claim and reclaims it only after expiry', async () => {
    let now = new Date('2026-08-14T12:00:00.000Z');
    state.triggerFindUnique.mockResolvedValueOnce(
      row({
        registrationIntentKind: 'unregister',
        registrationStatus: 'unregistering',
        registrationLeaseExpiresAt: new Date('2026-08-14T12:01:00.000Z')
      })
    );
    await expect(
      slateTriggerRegistrationLifecycleService.claim({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 5,
        operation: 'unregister',
        now
      })
    ).resolves.toBeNull();
    expect(state.triggerUpdateMany).not.toHaveBeenCalled();

    state.triggerFindUnique.mockResolvedValueOnce(
      row({
        registrationIntentKind: 'unregister',
        registrationStatus: 'unregistering',
        registrationLeaseExpiresAt: new Date('2026-08-14T11:59:00.000Z')
      })
    );
    await expect(
      slateTriggerRegistrationLifecycleService.claim({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 5,
        operation: 'unregister',
        now
      })
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'unregistering',
        registrationTransitionVersion: 3
      })
    );
    expect(state.triggerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ registrationLeaseExpiresAt: { lte: now } })
      })
    );
  });

  it('commits old-remote cleanup only for the owned reregister attempt', async () => {
    await expect(
      slateTriggerRegistrationLifecycleService.markRemoteRegistrationRemoved({
        receiverTriggerId: 'trigger-1',
        registrationGeneration: 5,
        registrationTransitionVersion: 3,
        registrationLeaseToken: 'lease-1',
        registrationLeaseExpiresAt: new Date('2026-08-14T12:02:00.000Z'),
        intent: 'reregister',
        status: 'registering'
      })
    ).resolves.toBe(true);
    expect(state.triggerUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'trigger-1',
        registrationGeneration: 5,
        registrationTransitionVersion: 3,
        registrationStatus: 'registering',
        registrationLeaseToken: 'lease-1',
        registrationLeaseExpiresAt: { gt: expect.any(Date) }
      },
      data: expect.objectContaining({
        remoteRegistrationKnown: false,
        encryptedRegistrationDetails: null,
        registrationDetailsGeneration: null
      })
    });
  });

  it('maps raw provider failures to the closed safe error vocabulary', () => {
    expect(safeRegistrationFailure(new Error('provider_rejected'))).toEqual({
      code: 'provider_rejected',
      message: 'The provider rejected webhook registration.'
    });
    expect(safeRegistrationFailure(new Error('cleanup_failed'))).toEqual({
      code: 'cleanup_failed',
      message: 'The previous provider registration could not be removed.'
    });
    expect(JSON.stringify(safeRegistrationFailure(new Error('secret=value')))).not.toContain(
      'secret=value'
    );
  });

  it('hard-deletes retained tombstones only after every remote registration is absent', async () => {
    let now = new Date('2026-08-14T12:00:00.000Z');
    state.receiverFindMany.mockResolvedValueOnce([{ oid: 91n }]);
    state.receiverDeleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(
      finalizeTruthfulTriggerReceiverCleanup({ now, batchSize: 10 })
    ).resolves.toEqual({ scanned: 1, deleted: 1 });
    expect(state.receiverFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tombstonedAt: {
            lte: new Date(now.getTime() - TRIGGER_RECEIVER_FINAL_RETENTION_MS)
          },
          triggers: {
            every: {
              registrationStatus: 'unregistered',
              remoteRegistrationKnown: false
            }
          }
        }
      })
    );
    expect(state.receiverDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          oid: 91n,
          triggers: {
            every: {
              registrationStatus: 'unregistered',
              remoteRegistrationKnown: false
            }
          }
        })
      })
    );
  });

  it('reconciles a declared verification mechanism and spec hash with exact CAS', async () => {
    state.triggerFindUnique.mockResolvedValueOnce({
      registrationGeneration: 5,
      verificationMechanism: 'path_secret_only',
      verificationSpecHash: 'a'.repeat(64),
      action: {
        spec: {
          specHash: 'b'.repeat(64),
          invocation: {
            http: {
              ingress: {
                kind: 'shared_provisioned_app',
                baseline: 'app_route_secret',
                routeFamily: 'github',
                verification: {
                  mechanism: 'hub',
                  allowedSecretRefs: [],
                  rules: [
                    {
                      id: 'bootstrap.v1',
                      phase: 'bootstrap',
                      when: { methods: ['POST'] },
                      verify: { type: 'preset', preset: 'zoom.v0' },
                      result: { type: 'sync_only' },
                      replay: {
                        kind: 'not_applicable',
                        reason: 'bootstrap_sync_only'
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    });
    await expect(
      slateTriggerRegistrationLifecycleService.reconcileVerificationDeclaration({
        receiverTriggerId: 'trigger-1',
        expectedRegistrationGeneration: 5,
        expectedSpecHash: 'a'.repeat(64)
      })
    ).resolves.toBe(true);
    expect(state.triggerUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          registrationGeneration: 5,
          verificationSpecHash: 'a'.repeat(64)
        }),
        data: expect.objectContaining({
          verificationMechanism: 'hub',
          verificationSpecHash: 'b'.repeat(64),
          authoritativeStateVersion: { increment: 1 }
        })
      })
    );
    expect(
      state.triggerUpdateMany.mock.calls.at(-1)?.[0].data.registrationGeneration
    ).toBeUndefined();
  });
});
