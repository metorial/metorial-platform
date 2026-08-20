import { Encryption, VersionedEncryptionKeyring } from '@lowerdeck/encryption';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../db', () => ({ db: {} }));
import { db } from '../db';
import {
  commitHubSecretReencryptionInTransaction,
  extractInstanceConfigSecretEntries,
  instanceConfigSecretMarker,
  prepareDeclaredInstanceConfigSecretImport,
  resolveDeclaredInstanceConfigSecretPath,
  slateTriggerReceiverSecretService,
  webhookSecretContexts
} from './slateTriggerReceiverSecret';

describe('Atomic captured registration secrets', () => {
  let fixture = () => {
    let specHash = 'a'.repeat(64);
    let actionContract: any = {
      id: 'registered_action',
      specHash,
      invocation: {
        type: 'webhook',
        http: {
          ingress: {
            verification: {
              allowedSecretRefs: [
                {
                  source: 'registration',
                  name: 'registration_secret',
                  registrationKey: 'secret',
                  encoding: 'utf8'
                }
              ],
              rules: []
            }
          }
        }
      }
    };
    let trigger: any = {
      oid: 31n,
      id: 'trigger-1',
      tenantOid: 11n,
      slateInstanceOid: 21n,
      receiverOid: 22n,
      registrationGeneration: 4,
      registrationVersion: 6,
      registrationTransitionVersion: 8,
      registrationStatus: 'registering',
      registrationLeaseToken: 'lease-1',
      action: { key: 'registered_action', spec: actionContract },
      receiver: {
        oid: 22n,
        id: 'receiver-1',
        tenantOid: 11n,
        slateInstanceOid: 21n,
        tenant: { oid: 11n, id: 'tenant-1' },
        slateInstance: { id: 'instance-1' }
      }
    };
    let authority: any = {
      receiverTrigger: trigger,
      version: {},
      actionId: 'registered_action',
      actionContract,
      specHash,
      registrationStatus: 'registering',
      registrationGeneration: 4,
      registrationVersion: 6,
      capturedSecretVersions: { registration_secret: 7 }
    };
    let claim = {
      receiverTriggerId: trigger.id,
      registrationGeneration: 4,
      registrationTransitionVersion: 8,
      registrationLeaseToken: 'lease-1',
      status: 'registering' as const
    };
    return { trigger, authority, claim };
  };

  let installTransaction = (
    trigger: any,
    options?: { stale?: boolean; failDetails?: boolean }
  ) => {
    let state = {
      secrets: [] as any[],
      audits: [] as any[],
      completed: false,
      writes: [] as any[]
    };
    let tx: any = {
      slateTriggerReceiverTrigger: {
        findFirst: vi.fn(async () => (options?.stale ? null : trigger)),
        findUnique: vi.fn(async () => trigger),
        findFirstOrThrow: vi.fn(async () => trigger),
        updateMany: vi.fn(async ({ data }: any) => {
          state.writes.push(data);
          if (data.encryptedRegistrationDetails && options?.failDetails) return { count: 0 };
          if (data.registrationStatus === 'registered') state.completed = true;
          return { count: 1 };
        })
      },
      slateTriggerReceiverSecret: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => {
          let secret = { ...data };
          state.secrets.push(secret);
          return secret;
        })
      },
      webhookSecretAuditRecord: {
        create: vi.fn(async ({ data }: any) => {
          state.audits.push(data);
          return data;
        })
      },
      webhookSecretOutboxRecord: {
        create: vi.fn(async ({ data }: any) => data)
      }
    };
    (db as any).$transaction = vi.fn(async (operation: (tx: any) => Promise<any>) => {
      let snapshot = structuredClone(state);
      try {
        return await operation(tx);
      } catch (error) {
        state.secrets = snapshot.secrets;
        state.audits = snapshot.audits;
        state.completed = snapshot.completed;
        state.writes = snapshot.writes;
        throw error;
      }
    });
    return state;
  };

  it('commits the exact declared secret and registered state in one transaction', async () => {
    let { trigger, authority, claim } = fixture();
    let state = installTransaction(trigger);
    await expect(
      slateTriggerReceiverSecretService.commitRegistrationResult({
        claim,
        authority,
        registrationDetails: { secret: 'captured-value' },
        remoteRegistrationKnown: true,
        capturedSecrets: {
          registration_secret: { value: 'captured-value', version: 7 }
        }
      })
    ).resolves.toBe('committed');
    expect(state.secrets).toHaveLength(1);
    expect(state.secrets[0]).toMatchObject({
      receiverTriggerOid: trigger.oid,
      receiverOid: trigger.receiverOid,
      specHash: authority.specHash,
      sourceBindingType: 'registration',
      sourceBindingId: 'trigger-1:4',
      name: 'registration_secret',
      secretVersion: 7,
      status: 'active'
    });
    expect(state.completed).toBe(true);
  });

  it('atomically commits encrypted null details, metadata, current state, and unknown remote registration', async () => {
    let { trigger, claim } = fixture();
    let state = installTransaction(trigger);
    let currentState = { cursor: 'current-trigger-state' };

    await expect(
      slateTriggerReceiverSecretService.commitRegistrationResult({
        claim,
        registrationDetails: null,
        state: currentState,
        remoteRegistrationKnown: false
      })
    ).resolves.toBe('committed');

    expect((db as any).$transaction).toHaveBeenCalledOnce();
    expect(state.writes).toHaveLength(3);
    expect(state.writes[0]).toMatchObject({
      encryptedRegistrationDetails: expect.any(String),
      registrationDetailsEncryptionKeyVersion: expect.any(Number),
      registrationDetailsAadVersion: expect.any(Number),
      registrationDetailsGeneration: trigger.registrationGeneration
    });
    expect(state.writes[1]).toEqual({
      registrationDetails: null,
      state: currentState
    });
    expect(state.writes[2]).toMatchObject({
      registrationStatus: 'registered',
      remoteRegistrationKnown: false,
      registrationLeaseToken: null,
      registrationLeaseExpiresAt: null
    });

    let persistedTrigger = { ...trigger, ...state.writes[0] };
    await expect(
      slateTriggerReceiverSecretService.resolveRegistrationDetailsInTransaction({
        tx: {
          slateTriggerReceiverTrigger: {
            findUniqueOrThrow: vi.fn(async () => persistedTrigger)
          }
        } as any,
        receiverTriggerId: trigger.id
      })
    ).resolves.toBeNull();
  });

  it('rejects wrong owner binding and stale claim before persisting anything', async () => {
    let { trigger, authority, claim } = fixture();
    let wrongBindingState = installTransaction(trigger);
    await expect(
      slateTriggerReceiverSecretService.commitRegistrationResult({
        claim,
        authority: {
          ...authority,
          receiverTrigger: {
            ...authority.receiverTrigger,
            receiver: { ...authority.receiverTrigger.receiver, id: 'wrong-receiver' }
          }
        },
        registrationDetails: {},
        remoteRegistrationKnown: true,
        capturedSecrets: {
          registration_secret: { value: 'captured-value', version: 7 }
        }
      })
    ).rejects.toThrow('owner binding is stale');
    expect(wrongBindingState.secrets).toHaveLength(0);

    let staleState = installTransaction(trigger, { stale: true });
    await expect(
      slateTriggerReceiverSecretService.commitRegistrationResult({
        claim,
        authority,
        registrationDetails: {},
        remoteRegistrationKnown: true,
        capturedSecrets: {
          registration_secret: { value: 'captured-value', version: 7 }
        }
      })
    ).resolves.toBe('stale');
    expect(staleState.secrets).toHaveLength(0);
    expect(staleState.writes).toHaveLength(0);
    expect(staleState.completed).toBe(false);
  });

  it('rolls secret creation back if encrypted registration-details CAS fails', async () => {
    let { trigger, authority, claim } = fixture();
    let state = installTransaction(trigger, { failDetails: true });
    await expect(
      slateTriggerReceiverSecretService.commitRegistrationResult({
        claim,
        authority,
        registrationDetails: { secret: 'captured-value' },
        remoteRegistrationKnown: true,
        capturedSecrets: {
          registration_secret: { value: 'captured-value', version: 7 }
        }
      })
    ).rejects.toThrow('Registration details CAS conflict');
    expect(state.secrets).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
    expect(state.completed).toBe(false);
  });

  it('atomically fans one Telegram generation and details across every active sibling binding', async () => {
    let telegramContract = (key: string, specHash: string) => ({
      id: key,
      specHash,
      invocation: {
        type: 'webhook',
        http: {
          ingress: {
            verification: {
              allowedSecretRefs: [
                {
                  source: 'registration',
                  name: 'telegram_secret_token',
                  registrationKey: 'secretToken',
                  encoding: 'utf8'
                }
              ],
              rules: []
            }
          }
        }
      }
    });
    let receiver: any = {
      oid: 22n,
      id: 'telegram-receiver',
      tenantOid: 11n,
      slateInstanceOid: 21n,
      tenant: { oid: 11n, id: 'tenant-1' },
      slateInstance: { id: 'instance-1' }
    };
    let first: any = {
      oid: 31n,
      id: 'telegram-message',
      tenantOid: 11n,
      slateInstanceOid: 21n,
      receiverOid: 22n,
      source: 'webhook',
      tombstonedAt: null,
      registrationGeneration: 4,
      registrationVersion: 6,
      registrationTransitionVersion: 8,
      registrationStatus: 'registering',
      registrationLeaseToken: 'lease-1',
      action: {
        key: 'message_received',
        spec: telegramContract('message_received', 'a'.repeat(64))
      },
      receiver
    };
    let sibling: any = {
      ...first,
      oid: 32n,
      id: 'telegram-callback',
      registrationGeneration: 7,
      registrationVersion: 9,
      registrationStatus: 'registered',
      registrationLeaseToken: null,
      action: {
        key: 'callback_query_received',
        spec: telegramContract('callback_query_received', 'b'.repeat(64))
      }
    };
    receiver.triggers = [first, sibling];
    let authority: any = {
      receiverTrigger: first,
      version: {},
      actionId: first.action.key,
      actionContract: first.action.spec,
      specHash: first.action.spec.specHash,
      registrationStatus: first.registrationStatus,
      registrationGeneration: first.registrationGeneration,
      registrationVersion: first.registrationVersion,
      capturedSecretVersions: { telegram_secret_token: 5 }
    };
    let claim = {
      receiverTriggerId: first.id,
      registrationGeneration: 4,
      registrationTransitionVersion: 8,
      registrationLeaseToken: 'lease-1',
      status: 'registering' as const
    };
    let state: any = {
      receiverCommitted: false,
      completed: false,
      details: [] as string[],
      current: new Map([
        [31n, { oid: 101n, receiverTriggerOid: 31n, secretVersion: 4, status: 'active' }],
        [32n, { oid: 102n, receiverTriggerOid: 32n, secretVersion: 4, status: 'active' }]
      ]),
      created: [] as any[],
      audits: [] as any[]
    };
    let tx: any = {
      slateTriggerReceiver: {
        updateMany: vi.fn(async () => {
          state.receiverCommitted = true;
          return { count: 1 };
        })
      },
      slateTriggerReceiverTrigger: {
        findFirst: vi.fn(async () => first),
        findMany: vi.fn(async () => [first, sibling]),
        findUnique: vi.fn(async ({ where }: any) => (where.id === first.id ? first : sibling)),
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (data.encryptedRegistrationDetails) state.details.push(String(where.oid));
          if (data.registrationStatus === 'registered') state.completed = true;
          return { count: 1 };
        })
      },
      slateTriggerReceiverSecret: {
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (where.oid) {
            for (let current of state.current.values()) {
              if (current.oid === where.oid) Object.assign(current, data);
            }
            return { count: 1 };
          }
          return { count: 0 };
        }),
        findFirst: vi.fn(async ({ where }: any) =>
          state.current.get(where.receiverTriggerOid)
        ),
        create: vi.fn(async ({ data }: any) => {
          state.created.push(data);
          return data;
        })
      },
      webhookSecretAuditRecord: {
        create: vi.fn(async ({ data }: any) => {
          state.audits.push(data);
          return data;
        })
      },
      webhookSecretOutboxRecord: { create: vi.fn(async ({ data }: any) => data) }
    };
    (db as any).$transaction = vi.fn(
      async (operation: (tx: any) => Promise<any>) => await operation(tx)
    );
    await expect(
      slateTriggerReceiverSecretService.commitRegistrationResult({
        claim,
        authority,
        registrationDetails: {
          secretToken: 'receiver-wide-token',
          singletonGeneration: 5,
          allowedUpdates: ['callback_query', 'message']
        },
        remoteRegistrationKnown: true,
        capturedSecrets: {
          telegram_secret_token: { value: 'receiver-wide-token', version: 5 }
        },
        telegramAuthority: {
          receiverOid: 22n,
          token: 'telegram-lease',
          mutationVersion: 12,
          generation: 5,
          refCount: 2,
          allowedUpdates: ['callback_query', 'message'],
          webhookUrl: 'https://hooks.test/receivers/telegram-receiver',
          secretFingerprint: 'c'.repeat(64)
        }
      })
    ).resolves.toBe('committed');
    expect(state.receiverCommitted).toBe(true);
    expect(state.details.sort()).toEqual(['31', '32']);
    expect(state.created).toHaveLength(2);
    expect(
      state.created.map((secret: any) => ({
        receiverTriggerOid: secret.receiverTriggerOid,
        specHash: secret.specHash,
        sourceBindingId: secret.sourceBindingId,
        version: secret.secretVersion,
        status: secret.status
      }))
    ).toEqual([
      {
        receiverTriggerOid: 31n,
        specHash: 'a'.repeat(64),
        sourceBindingId: 'telegram-message:4',
        version: 5,
        status: 'active'
      },
      {
        receiverTriggerOid: 32n,
        specHash: 'b'.repeat(64),
        sourceBindingId: 'telegram-callback:7',
        version: 5,
        status: 'active'
      }
    ]);
    expect([...state.current.values()]).toEqual([
      expect.objectContaining({ status: 'retiring', validUntil: expect.any(Date) }),
      expect.objectContaining({ status: 'retiring', validUntil: expect.any(Date) })
    ]);
    expect(state.completed).toBe(true);
  });

  it('rolls back the complete Telegram fanout if a sibling projection loses CAS', async () => {
    let { trigger, authority, claim } = fixture();
    let telegramContract = JSON.parse(
      JSON.stringify(authority.actionContract).replaceAll(
        'registration_secret',
        'telegram_secret_token'
      )
    );
    trigger.action.spec = telegramContract;
    let sibling: any = {
      ...trigger,
      oid: 32n,
      id: 'trigger-2',
      registrationGeneration: 7,
      registrationVersion: 9,
      registrationStatus: 'registered',
      registrationLeaseToken: null,
      action: {
        key: 'registered_action_2',
        spec: {
          ...telegramContract,
          id: 'registered_action_2',
          specHash: 'b'.repeat(64)
        }
      }
    };
    let state = {
      receiverWrites: 0,
      secrets: [] as any[],
      audits: [] as any[],
      projectedDetails: [] as bigint[]
    };
    let tx: any = {
      slateTriggerReceiver: {
        updateMany: vi.fn(async () => {
          state.receiverWrites++;
          return { count: 1 };
        })
      },
      slateTriggerReceiverTrigger: {
        findFirst: vi.fn(async () => trigger),
        findMany: vi.fn(async () => [trigger, sibling]),
        findUnique: vi.fn(async ({ where }: any) =>
          where.id === trigger.id ? trigger : sibling
        ),
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (data.encryptedRegistrationDetails) {
            if (where.oid === sibling.oid) return { count: 0 };
            state.projectedDetails.push(where.oid);
          }
          return { count: 1 };
        })
      },
      slateTriggerReceiverSecret: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => {
          state.secrets.push(data);
          return data;
        })
      },
      webhookSecretAuditRecord: {
        create: vi.fn(async ({ data }: any) => {
          state.audits.push(data);
          return data;
        })
      },
      webhookSecretOutboxRecord: { create: vi.fn(async ({ data }: any) => data) }
    };
    (db as any).$transaction = vi.fn(async (operation: (tx: any) => Promise<any>) => {
      let snapshot = structuredClone(state);
      try {
        return await operation(tx);
      } catch (error) {
        state.receiverWrites = snapshot.receiverWrites;
        state.secrets = snapshot.secrets;
        state.audits = snapshot.audits;
        state.projectedDetails = snapshot.projectedDetails;
        throw error;
      }
    });
    await expect(
      slateTriggerReceiverSecretService.commitRegistrationResult({
        claim,
        authority: {
          ...authority,
          capturedSecretVersions: { telegram_secret_token: 5 },
          actionContract: telegramContract
        },
        registrationDetails: { secretToken: 'token' },
        remoteRegistrationKnown: true,
        capturedSecrets: {
          telegram_secret_token: { value: 'token', version: 5 }
        },
        telegramAuthority: {
          receiverOid: trigger.receiverOid,
          token: 'telegram-lease',
          mutationVersion: 12,
          generation: 5,
          refCount: 1,
          allowedUpdates: ['message'],
          webhookUrl: 'https://hooks.test/receivers/receiver-1',
          secretFingerprint: 'c'.repeat(64)
        }
      })
    ).rejects.toThrow();
    expect(state.receiverWrites).toBe(0);
    expect(state.secrets).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
    expect(state.projectedDetails).toHaveLength(0);
  });

  it('resolves only the active current generation and bounded retiring generations', async () => {
    let { trigger } = fixture();
    trigger.receiver.slateInstance.tenantOid = trigger.tenantOid;
    trigger.receiver.slateInstance.currentConfig = null;
    trigger.receiver.authConfig = null;
    let findMany = vi.fn(async () => []);
    (db as any).slateTriggerReceiverTrigger = {
      findUnique: vi.fn(async () => trigger),
      findFirst: vi.fn(async () => trigger)
    };
    (db as any).slateTriggerReceiver = {
      findFirst: vi.fn(async () => trigger.receiver)
    };
    (db as any).slateTriggerReceiverSecret = { findMany };
    await expect(
      slateTriggerReceiverSecretService.resolveDeclaredTriggerSecretsForVerification({
        receiverTriggerId: trigger.id,
        name: 'registration_secret',
        now: new Date('2030-01-01T00:00:00.000Z')
      })
    ).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          receiverTriggerOid: trigger.oid,
          specHash: trigger.action.spec.specHash,
          sourceBindingType: 'registration',
          name: 'registration_secret',
          OR: [
            { status: 'active', sourceBindingId: 'trigger-1:4' },
            {
              status: 'retiring',
              sourceBindingId: { startsWith: 'trigger-1:' },
              validUntil: { gt: new Date('2030-01-01T00:00:00.000Z') }
            }
          ]
        })
      })
    );
  });
});

describe('Hub webhook secret AAD', () => {
  let base = {
    tenantId: 'tenant-1',
    slateInstanceId: 'instance-1',
    receiverId: 'receiver-1',
    secretVersion: 4,
    encryptionKeyVersion: 2,
    aadVersion: 1
  };

  it('round trips only with the exact closed receiver path context', async () => {
    let provider = new Encryption('test-key');
    let encrypted = await provider.encrypt({
      entityId: webhookSecretContexts.receiverPath(base),
      secret: 'metorial_whpath_secret'
    });
    await expect(
      provider.decrypt({ entityId: webhookSecretContexts.receiverPath(base), encrypted })
    ).resolves.toBe('metorial_whpath_secret');
    for (let changed of [
      { ...base, tenantId: 'tenant-2' },
      { ...base, slateInstanceId: 'instance-2' },
      { ...base, receiverId: 'receiver-2' },
      { ...base, secretVersion: 5 },
      { ...base, encryptionKeyVersion: 3 },
      { ...base, aadVersion: 2 }
    ]) {
      await expect(
        provider.decrypt({ entityId: webhookSecretContexts.receiverPath(changed), encrypted })
      ).rejects.toThrow();
    }
  });

  it('binds trigger purpose and immutable source identity independently', () => {
    let trigger = {
      tenantId: 'tenant-1',
      slateInstanceId: 'instance-1',
      receiverId: 'receiver-1',
      receiverTriggerId: 'trigger-1',
      specHash: 'spec',
      sourceBindingType: 'provider_config',
      sourceBindingId: 'config-1',
      name: 'signing_secret',
      kind: 'hmac',
      encoding: 'utf8',
      secretVersion: 1,
      encryptionKeyVersion: 1,
      aadVersion: 1
    };
    expect(webhookSecretContexts.trigger(trigger)).not.toBe(
      webhookSecretContexts.trigger({ ...trigger, sourceBindingId: 'config-2' })
    );
    expect(webhookSecretContexts.trigger(trigger)).not.toBe(
      webhookSecretContexts.trigger({ ...trigger, name: 'verification_token' })
    );
  });

  it('keeps semantic version stable when only envelope versions change', () => {
    let next = { ...base, encryptionKeyVersion: 3, aadVersion: 2 };
    expect(next.secretVersion).toBe(base.secretVersion);
    expect(webhookSecretContexts.receiverPath(next)).not.toBe(
      webhookSecretContexts.receiverPath(base)
    );
  });

  it('keeps config, registration, route purposes, and receipts in disjoint contexts', () => {
    let config = webhookSecretContexts.config({
      tenantId: 'tenant-1',
      instanceConfigId: 'config-1',
      key: 'client_secret',
      secretVersion: 1,
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let registration = webhookSecretContexts.registration({
      tenantId: 'tenant-1',
      slateInstanceId: 'instance-1',
      receiverId: 'receiver-1',
      receiverTriggerId: 'trigger-1',
      registrationGeneration: 1,
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let route = {
      provisionedRouteId: 'route-1',
      routeGeneration: 1,
      vendor: 'vendor',
      credentialOwnerRef: 'owner-1',
      purpose: 'app_route_path' as const,
      secretVersion: 1,
      encryptionKeyVersion: 1,
      aadVersion: 1
    };
    expect(new Set([config, registration, webhookSecretContexts.appRoute(route)]).size).toBe(
      3
    );
    expect(webhookSecretContexts.appRoute(route)).not.toBe(
      webhookSecretContexts.appRoute({ ...route, purpose: 'vendor_verification' })
    );
    expect(
      webhookSecretContexts.receipt({
        receiptId: 'receipt-1',
        secretClass: 'receiver_path',
        secretId: 'secret-1'
      })
    ).not.toBe(
      webhookSecretContexts.receipt({
        receiptId: 'receipt-1',
        secretClass: 'app_route_path',
        secretId: 'secret-1'
      })
    );
  });

  it('uses a presence-only config marker with no secret value or resolvable ID', () => {
    let marker = instanceConfigSecretMarker('client_secret');
    expect(marker).toEqual({
      type: 'metorial.instance_config_secret/v1',
      key: 'client_secret',
      present: true
    });
    expect(JSON.stringify(marker)).not.toContain('secret-value');
    expect(marker).not.toHaveProperty('secretId');
  });

  it('recursively discovers nested object, array, and record secrets', () => {
    let entries = extractInstanceConfigSecretEntries({
      schema: {
        type: 'object',
        properties: {
          auth: {
            type: 'object',
            properties: { token: { type: 'string', writeOnly: true } }
          },
          clients: {
            type: 'array',
            items: {
              type: 'object',
              properties: { secret: { type: 'string', format: 'secret' } }
            }
          },
          record: {
            type: 'object',
            additionalProperties: { type: 'string', 'x-secret': true }
          }
        }
      },
      value: {
        auth: { token: 'nested-token' },
        clients: [{ secret: 'first' }, { secret: 'second' }],
        record: { east: 'east-secret', west: 'west-secret' }
      }
    });
    expect(entries.map(entry => [entry.key, entry.plaintext])).toEqual([
      ['auth/token', 'nested-token'],
      ['clients/0/secret', 'first'],
      ['clients/1/secret', 'second'],
      ['record/east', 'east-secret'],
      ['record/west', 'west-secret']
    ]);
  });

  it('authorizes only canonical nested paths declared secret by the persisted schema', () => {
    let schema = {
      type: 'object',
      properties: {
        clients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              secret: { type: 'string', writeOnly: true },
              label: { type: 'string' }
            }
          }
        },
        regions: {
          type: 'object',
          additionalProperties: { type: 'string', 'x-secret': true }
        }
      }
    };
    expect(
      resolveDeclaredInstanceConfigSecretPath({ schema, key: 'clients/0/secret' })
    ).toEqual(['clients', 0, 'secret']);
    expect(resolveDeclaredInstanceConfigSecretPath({ schema, key: 'regions/eu' })).toEqual([
      'regions',
      'eu'
    ]);
    expect(() =>
      resolveDeclaredInstanceConfigSecretPath({ schema, key: 'clients/0/label' })
    ).toThrow('not a declared secret field');
    expect(() =>
      resolveDeclaredInstanceConfigSecretPath({ schema, key: 'clients/00/secret' })
    ).toThrow('not a declared secret field');
    expect(() =>
      resolveDeclaredInstanceConfigSecretPath({ schema, key: 'clients/~2/secret' })
    ).toThrow('not canonical');
  });

  it('prepares nested authenticated imports without breaking old-app plaintext compatibility', () => {
    let schema = {
      type: 'object',
      properties: {
        clients: {
          type: 'array',
          items: {
            type: 'object',
            properties: { secret: { type: 'string', writeOnly: true } }
          }
        }
      }
    };
    let prepared = prepareDeclaredInstanceConfigSecretImport({
      schema,
      value: { clients: [{ secret: 'old-value' }] },
      key: 'clients/0/secret',
      plaintext: 'new-value',
      markerCutover: false
    });
    expect(prepared.key).toBe('clients/0/secret');
    expect(prepared.value).toEqual({ clients: [{ secret: 'new-value' }] });
    expect(
      prepareDeclaredInstanceConfigSecretImport({
        schema,
        value: { clients: [{ secret: 'old-value' }] },
        key: 'clients/0/secret',
        plaintext: 'new-value',
        markerCutover: true
      }).value
    ).toEqual({
      clients: [
        {
          secret: {
            type: 'metorial.instance_config_secret/v1',
            key: 'clients/0/secret',
            present: true
          }
        }
      ]
    });
    expect(() =>
      prepareDeclaredInstanceConfigSecretImport({
        schema,
        value: { clients: [] },
        key: 'clients/0/secret',
        plaintext: 'new-value',
        markerCutover: false
      })
    ).toThrow('absent from the config value');
  });

  it('commits every re-encryption class with one correlated audit/outbox boundary', async () => {
    for (let secretClass of [
      'registration_details',
      'receiver_path',
      'instance_config',
      'bound_trigger',
      'app_route_path'
    ]) {
      let writes: { kind: string; data: Record<string, unknown> }[] = [];
      let tx = {
        webhookSecretAuditRecord: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            writes.push({ kind: 'audit', data });
            return data;
          }
        },
        webhookSecretOutboxRecord: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            writes.push({ kind: 'outbox', data });
            return data;
          }
        }
      };
      let lifecycle = { secretVersion: 9, validUntil: 'deadline', receiptId: 'receipt-1' };
      let callbackReceiverOwner =
        secretClass === 'receiver_path'
          ? {
              tenantId: 'tenant-1',
              receiverId: 'receiver-1',
              callbackId: 'callback-1',
              callbackInstanceId: 'callback-instance-1',
              receiverAuthorityVersion: 3
            }
          : undefined;
      let result = await commitHubSecretReencryptionInTransaction({
        tx: tx as never,
        actor: { actorId: 'service-1', requestId: 'request-1' },
        callbackReceiverOwner,
        metadata: { secretClass, secretId: `${secretClass}-1` },
        mutate: async () => lifecycle
      });
      expect(result.secret).toBe(lifecycle);
      expect(result.auditCorrelationId).toBeTruthy();
      expect(writes.map(write => write.kind)).toEqual(['audit', 'outbox']);
      expect(writes[0]!.data).toMatchObject({
        action: 'secret_projected',
        auditCorrelationId: result.auditCorrelationId,
        metadata: expect.objectContaining({ operation: 'reencrypt', secretClass })
      });
      expect(writes[1]!.data).toMatchObject({
        action: 'secret_projected',
        auditCorrelationId: result.auditCorrelationId
      });
      expect(lifecycle).toEqual({
        secretVersion: 9,
        validUntil: 'deadline',
        receiptId: 'receipt-1'
      });
    }
  });

  it('rolls back envelope mutation when audit persistence fails for every class', async () => {
    for (let secretClass of [
      'registration_details',
      'receiver_path',
      'instance_config',
      'bound_trigger',
      'app_route_path'
    ]) {
      let state = { envelopeVersion: 1 };
      let runTransaction = async (operation: () => Promise<void>) => {
        let snapshot = structuredClone(state);
        try {
          await operation();
        } catch (error) {
          state = snapshot;
          throw error;
        }
      };
      await expect(
        runTransaction(async () => {
          let callbackReceiverOwner =
            secretClass === 'receiver_path'
              ? {
                  tenantId: 'tenant-1',
                  receiverId: 'receiver-1',
                  callbackId: 'callback-1',
                  callbackInstanceId: 'callback-instance-1',
                  receiverAuthorityVersion: 3
                }
              : undefined;
          await commitHubSecretReencryptionInTransaction({
            tx: {
              webhookSecretAuditRecord: {
                create: async () => {
                  throw new Error('injected audit failure');
                }
              },
              webhookSecretOutboxRecord: { create: async () => ({}) }
            } as never,
            actor: { actorId: 'service-1', requestId: 'request-1' },
            callbackReceiverOwner,
            metadata: { secretClass, secretId: `${secretClass}-1` },
            mutate: async () => {
              state.envelopeVersion = 2;
            }
          });
        })
      ).rejects.toThrow('injected audit failure');
      expect(state.envelopeVersion).toBe(1);
    }
  });

  it('reads v1 while v2 is active and re-encrypts without semantic lifecycle changes', async () => {
    let keyring = new VersionedEncryptionKeyring({
      keys: { 1: 'old-hub-key', 2: 'new-hub-key' },
      activeKeyVersion: 2,
      supportedAadVersions: [1, 2]
    });
    let lifecycle = {
      secretVersion: 7,
      validUntil: new Date('2030-01-02T00:00:00.000Z'),
      receiptId: 'receipt-1'
    };
    let v1 = {
      ...base,
      secretVersion: lifecycle.secretVersion,
      encryptionKeyVersion: 1,
      aadVersion: 1
    };
    let encryptedV1 = await keyring.encrypt({
      secret: 'hub-material',
      entityId: webhookSecretContexts.receiverPath(v1),
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let plaintext = await keyring.decrypt({
      encrypted: encryptedV1,
      entityId: webhookSecretContexts.receiverPath(v1),
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let v2 = { ...v1, encryptionKeyVersion: 2, aadVersion: 2 };
    let encryptedV2 = await keyring.encrypt({
      secret: plaintext,
      entityId: webhookSecretContexts.receiverPath(v2),
      encryptionKeyVersion: 2,
      aadVersion: 2
    });
    await expect(
      keyring.decrypt({
        encrypted: encryptedV2,
        entityId: webhookSecretContexts.receiverPath(v2),
        encryptionKeyVersion: 2,
        aadVersion: 2
      })
    ).resolves.toBe('hub-material');
    expect(lifecycle).toEqual({
      secretVersion: 7,
      validUntil: new Date('2030-01-02T00:00:00.000Z'),
      receiptId: 'receipt-1'
    });
    expect(() => webhookSecretContexts.receiverPath({ ...v2, aadVersion: 3 })).toThrow(
      'Unsupported Hub webhook AAD grammar'
    );
  });
});
