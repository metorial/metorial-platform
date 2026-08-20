import { beforeEach, describe, expect, it } from 'vitest';
import {
  SlateTriggerReceiverStatus,
  SlateTriggerReceiverTriggerSource
} from '../../../../prisma/generated/client';
import { env } from '../../../env';
import {
  slateTriggerReceiverSecretService,
  slateTriggerReceiverService,
  slateTriggerRegistrationLifecycleService
} from '../../../services';
import { beginRegistrationIntentInTransaction } from '../../../services/slateTriggerRegistrationLifecycle';
import {
  finalizeTruthfulTriggerReceiverCleanup,
  TRIGGER_RECEIVER_FINAL_RETENTION_MS
} from '../../../queues/trigger/register';
import { createTestHubSecretClient, slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';
import {
  configureSlatesHubSecretReplayStoreForTest,
  slatesHubSecretKeyIdHeader
} from '../slateTriggerReceiverSecretRpcAuth';

describe('slateTriggerReceiver:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns trigger receivers for a tenant', async () => {
    const { receiver, tenant, slate, instance } = await f.slateTriggerReceiver.complete();

    await f.slateTriggerReceiver.withInstance({
      tenantOid: tenant.oid,
      slateOid: slate.oid
    });

    const result = await slatesHubClient.slateTriggerReceiver.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: receiver.id,
      slateId: slate.id,
      slateInstanceId: instance.id,
      authConfigId: null,
      status: SlateTriggerReceiverStatus.active,
      name: receiver.name,
      description: receiver.description,
      eventTypes: receiver.eventTypes,
      consecutivePollingFailures: 0,
      consecutiveEventFailures: 0,
      triggers: expect.any(Array),
      destinations: expect.any(Array),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });

  it('filters by slateIds', async () => {
    const {
      receiver: receiver1,
      tenant,
      slate: slate1
    } = await f.slateTriggerReceiver.complete({
      slateIdentifier: 'slate-1'
    });

    const slate2 = await f.slate.complete({ slateIdentifier: 'slate-2' });
    const instance2 = await f.slateInstance.default({
      slateOid: slate2.oid,
      tenantOid: tenant.oid
    });
    await f.slateTriggerReceiver.default({
      tenantOid: tenant.oid,
      slateOid: slate2.oid,
      instanceOid: instance2.oid
    });

    const result = await slatesHubClient.slateTriggerReceiver.list({
      tenantId: tenant.id,
      slateIds: [slate1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(receiver1.id);
  });

  it('filters by slateInstanceIds', async () => {
    const {
      receiver: receiver1,
      tenant,
      instance: instance1
    } = await f.slateTriggerReceiver.complete();

    const slate2 = await f.slate.complete();
    const instance2 = await f.slateInstance.default({
      slateOid: slate2.oid,
      tenantOid: tenant.oid
    });
    await f.slateTriggerReceiver.default({
      tenantOid: tenant.oid,
      slateOid: slate2.oid,
      instanceOid: instance2.oid
    });

    const result = await slatesHubClient.slateTriggerReceiver.list({
      tenantId: tenant.id,
      slateInstanceIds: [instance1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(receiver1.id);
  });
});

describe('slateTriggerReceiver:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single trigger receiver by ID', async () => {
    const { receiver, tenant, slate } = await f.slateTriggerReceiver.complete();

    const result = await slatesHubClient.slateTriggerReceiver.get({
      tenantId: tenant.id,
      slateTriggerReceiverId: receiver.id
    });

    expect(result).toMatchObject({
      id: receiver.id,
      status: SlateTriggerReceiverStatus.active,
      slateId: slate.id,
      consecutivePollingFailures: 0,
      consecutiveEventFailures: 0
    });
    expect(result.triggers[0]).toMatchObject({
      registrationStatus: expect.stringMatching(
        /^(pending|registering|registered|renewing|failed|unregistering|unregistered)$/
      ),
      registrationGeneration: expect.any(Number),
      registrationTransitionVersion: expect.any(Number),
      verificationMechanism: expect.stringMatching(/^(path_secret_only|hub|provider)$/)
    });
    expect(result.triggers[0]).toHaveProperty('registrationError');
    expect(JSON.stringify(result)).not.toMatch(
      /registrationDetails|encryptedRegistrationDetails/
    );
  });
});

describe('slateTriggerReceiver:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple trigger receivers by IDs', async () => {
    const tenant = await f.tenant.default();
    const slate = await f.slate.complete();

    const receiver1 = await f.slateTriggerReceiver.withInstance({
      tenantOid: tenant.oid,
      slateOid: slate.oid
    });
    const receiver2 = await f.slateTriggerReceiver.withInstance({
      tenantOid: tenant.oid,
      slateOid: slate.oid
    });

    const result = await slatesHubClient.slateTriggerReceiver.getMany({
      tenantId: tenant.id,
      slateTriggerReceiverIds: [receiver1.id, receiver2.id]
    });

    expect(result).toMatchObject([{ id: receiver1.id }, { id: receiver2.id }]);
  });
});

describe('authenticated receiver secret RPC E2E', () => {
  let f = fixtures(testDb);
  let rpcToken = 'hub-secret-e2e-token';
  let signedSecretClient = () =>
    createTestHubSecretClient({
      getSignatureToken: () => rpcToken,
      getHeaders: () => ({ [slatesHubSecretKeyIdHeader]: 'current' })
    });
  let bindCallbackReceiver = async (
    receiver: { oid: bigint; id: string },
    tenantId: string
  ) => {
    let callbackAuthority = {
      tenantId,
      receiverId: receiver.id,
      callbackId: `callback-${receiver.id}`,
      callbackInstanceId: `callback-instance-${receiver.id}`,
      receiverAuthorityVersion: 1,
      trustedActorId: 'organization-actor-e2e',
      requestId: `request-${receiver.id}`,
      requestIp: '192.0.2.20',
      requestUserAgent: 'callback-e2e'
    };
    await testDb.slateTriggerReceiver.update({
      where: { oid: receiver.oid },
      data: {
        callbackId: callbackAuthority.callbackId,
        callbackInstanceId: callbackAuthority.callbackInstanceId,
        callbackOwnerVersion: callbackAuthority.receiverAuthorityVersion,
        status: 'active',
        tombstonedAt: null
      }
    });
    return callbackAuthority;
  };

  beforeEach(async () => {
    await cleanDatabase();
    env.slates.SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_CURRENT = rpcToken;
    configureSlatesHubSecretReplayStoreForTest({ claim: async () => true });
  });

  it('keeps provisioned route and tenant-binding projections on the signed RPC boundary', async () => {
    let unsigned = createTestHubSecretClient();
    await expect(
      unsigned.getProvisionedAppProjectionState({
        entityKind: 'route',
        entityId: 'untrusted-selector'
      })
    ).rejects.toThrow();

    let signed = signedSecretClient();
    await expect(
      signed.getProvisionedAppProjectionState({
        entityKind: 'route',
        entityId: 'missing-authoritative-route'
      })
    ).resolves.toBeNull();

    await expect(
      slatesHubClient.slateTriggerReceiver.projectProvisionedAppRoute({
        tenantId: 'payload-selected-tenant'
      } as never)
    ).rejects.toThrow('authenticated service RPC');
  });

  it('requires a signed call and enforces one-time path receipt consumption', async () => {
    let { receiver, tenant } = await f.slateTriggerReceiver.complete();
    let callbackAuthority = await bindCallbackReceiver(receiver, tenant.id);
    let unsigned = createTestHubSecretClient();
    await expect(unsigned.createReceiverPath(callbackAuthority)).rejects.toThrow();

    let signed = signedSecretClient();
    for (let forged of [
      { tenantId: 'tenant-wrong' },
      { callbackId: 'callback-wrong' },
      { callbackInstanceId: 'callback-instance-wrong' },
      { receiverAuthorityVersion: callbackAuthority.receiverAuthorityVersion + 1 },
      { receiverId: 'receiver-wrong' }
    ]) {
      await expect(
        signed.createReceiverPath({ ...callbackAuthority, ...forged })
      ).rejects.toThrow();
    }
    expect(
      await testDb.slateTriggerReceiverPathSecret.count({
        where: { receiverOid: receiver.oid }
      })
    ).toBe(0);
    let created = await signed.createReceiverPath(callbackAuthority);
    expect(created.secret).toMatchObject({ status: 'active', secretVersion: 1 });
    expect(created.secretIssuanceReceipt).toMatchObject({
      id: expect.any(String),
      token: expect.any(String)
    });
    expect(JSON.stringify(created)).not.toMatch(/encryptedValue|lookupHash/);

    let receipt = created.secretIssuanceReceipt;
    await expect(
      signed.consumeReceiverPathReceipt({
        ...callbackAuthority,
        receiptId: receipt.id,
        receiptToken: receipt.token
      })
    ).resolves.toMatchObject({ plaintext: expect.stringMatching(/^metorial_whpath_/) });
    await expect(
      signed.consumeReceiverPathReceipt({
        ...callbackAuthority,
        receiptId: receipt.id,
        receiptToken: receipt.token
      })
    ).rejects.toThrow();

    await expect(
      unsigned.rotateReceiverPath({ ...callbackAuthority, graceMs: 1 })
    ).rejects.toThrow();
    let rotated = await signed.rotateReceiverPath({
      ...callbackAuthority,
      graceMs: 1
    });
    expect(rotated.secret).toMatchObject({ status: 'active', secretVersion: 2 });
    expect(rotated.secretIssuanceReceipt).toMatchObject({
      id: expect.any(String),
      token: expect.any(String)
    });
    expect(JSON.stringify(rotated)).not.toMatch(/encryptedValue|lookupHash|plaintext/);

    let retiring = await testDb.slateTriggerReceiverPathSecret.findFirstOrThrow({
      where: { receiverOid: receiver.oid, status: 'retiring' }
    });
    expect(retiring.validUntil).not.toBeNull();
    let beforeExpiry = await slateTriggerReceiverSecretService.resolvePathActiveAndRetiring({
      tenant,
      receiverId: receiver.id,
      now: new Date(retiring.validUntil!.getTime() - 1)
    });
    expect(beforeExpiry.map(item => item.secret.id)).toContain(retiring.id);
    let atExpiry = await slateTriggerReceiverSecretService.resolvePathActiveAndRetiring({
      tenant,
      receiverId: receiver.id,
      now: retiring.validUntil!
    });
    expect(atExpiry.map(item => item.secret.id)).not.toContain(retiring.id);

    await expect(
      unsigned.revokeReceiverPath({
        ...callbackAuthority,
        secretId: rotated.secret.id
      })
    ).rejects.toThrow();
    await signed.revokeReceiverPath({
      ...callbackAuthority,
      secretId: rotated.secret.id
    });
    await expect(
      signed.consumeReceiverPathReceipt({
        ...callbackAuthority,
        receiptId: rotated.secretIssuanceReceipt.id,
        receiptToken: rotated.secretIssuanceReceipt.token
      })
    ).rejects.toThrow();
  });

  it('denies an unconsumed receipt after its secret becomes retiring', async () => {
    let { receiver, tenant } = await f.slateTriggerReceiver.complete();
    let callbackAuthority = await bindCallbackReceiver(receiver, tenant.id);
    let signed = signedSecretClient();
    let created = await signed.createReceiverPath(callbackAuthority);
    await signed.rotateReceiverPath({ ...callbackAuthority, graceMs: 60_000 });

    await expect(
      signed.consumeReceiverPathReceipt({
        ...callbackAuthority,
        receiptId: created.secretIssuanceReceipt.id,
        receiptToken: created.secretIssuanceReceipt.token
      })
    ).rejects.toThrow();
  });

  it('revokes the previous secret on zero-grace rotation and bulk-revokes every path secret', async () => {
    let { receiver, tenant } = await f.slateTriggerReceiver.complete();
    let callbackAuthority = await bindCallbackReceiver(receiver, tenant.id);
    let signed = signedSecretClient();

    await signed.createReceiverPath(callbackAuthority);
    let immediate = await signed.rotateReceiverPath({ ...callbackAuthority, graceMs: 0 });
    expect(immediate.secret).toMatchObject({ status: 'active', secretVersion: 2 });
    expect(
      await testDb.slateTriggerReceiverPathSecret.count({
        where: { receiverOid: receiver.oid, status: 'retiring' }
      })
    ).toBe(0);
    let revokedByRotation = await testDb.slateTriggerReceiverPathSecret.findFirstOrThrow({
      where: { receiverOid: receiver.oid, secretVersion: 1 }
    });
    expect(revokedByRotation.status).toBe('revoked');
    expect(revokedByRotation.revokedAt).not.toBeNull();
    expect(
      (
        await slateTriggerReceiverSecretService.resolvePathActiveAndRetiring({
          tenant,
          receiverId: receiver.id
        })
      ).map(item => item.secret.secretVersion)
    ).toEqual([2]);

    await signed.rotateReceiverPath({ ...callbackAuthority, graceMs: 60_000 });
    let unsigned = createTestHubSecretClient();
    await expect(unsigned.revokeAllReceiverPath(callbackAuthority)).rejects.toThrow();
    let revokedAll = await signed.revokeAllReceiverPath(callbackAuthority);
    expect(revokedAll.revokedCount).toBe(2);
    expect(revokedAll.secrets.every(secret => secret.status === 'revoked')).toBe(true);
    expect(JSON.stringify(revokedAll)).not.toMatch(/encryptedValue|lookupHash|plaintext/);
    expect(
      await testDb.slateTriggerReceiverPathSecret.count({
        where: { receiverOid: receiver.oid, status: { in: ['active', 'retiring'] } }
      })
    ).toBe(0);
    expect(
      await slateTriggerReceiverSecretService.resolvePathActiveAndRetiring({
        tenant,
        receiverId: receiver.id
      })
    ).toEqual([]);

    // Creating a fresh secret after a full revocation must continue the version
    // sequence past the revoked rows instead of colliding with version 1.
    let recreated = await signed.createReceiverPath(callbackAuthority);
    expect(recreated.secret).toMatchObject({ status: 'active', secretVersion: 4 });
    expect(
      (
        await slateTriggerReceiverSecretService.resolvePathActiveAndRetiring({
          tenant,
          receiverId: receiver.id
        })
      ).map(item => item.secret.secretVersion)
    ).toEqual([4]);
  });

  it('sweeps lapsed retiring path secrets to revoked once their grace window ends', async () => {
    let { receiver, tenant } = await f.slateTriggerReceiver.complete();
    let callbackAuthority = await bindCallbackReceiver(receiver, tenant.id);
    let signed = signedSecretClient();

    await signed.createReceiverPath(callbackAuthority);
    await signed.rotateReceiverPath({ ...callbackAuthority, graceMs: 60_000 });
    let retiring = await testDb.slateTriggerReceiverPathSecret.findFirstOrThrow({
      where: { receiverOid: receiver.oid, status: 'retiring' }
    });

    let beforeExpiry = await slateTriggerReceiverSecretService.cleanupExpiredPathSecrets({
      now: new Date(retiring.validUntil!.getTime() - 1)
    });
    expect(beforeExpiry.count).toBe(0);

    let atExpiry = await slateTriggerReceiverSecretService.cleanupExpiredPathSecrets({
      now: retiring.validUntil!
    });
    expect(atExpiry.count).toBe(1);
    let swept = await testDb.slateTriggerReceiverPathSecret.findUniqueOrThrow({
      where: { oid: retiring.oid }
    });
    expect(swept.status).toBe('revoked');
    expect(swept.revokedAt).not.toBeNull();
  });

  it('runs declared generated, imported, and nested config lifecycles without issuing ineligible receipts or leaking metadata', async () => {
    let { receiver, receiverTrigger, triggerAction, slate, instance, tenant } =
      await f.slateTriggerReceiver.complete();
    let callbackAuthority = await bindCallbackReceiver(receiver, tenant.id);
    let specHash = 'a'.repeat(64);
    if (triggerAction.spec.type !== 'action.trigger') {
      throw new Error('Expected a trigger action fixture');
    }
    await testDb.slateAction.update({
      where: { oid: triggerAction.oid },
      data: {
        spec: {
          ...triggerAction.spec,
          specHash,
          invocation: {
            type: 'webhook',
            autoRegistration: false,
            autoUnregistration: false,
            http: {
              ingress: {
                kind: 'receiver_route',
                baseline: 'receiver_path_secret',
                verification: {
                  mechanism: 'hub',
                  baseline: 'receiver_path_secret',
                  allowedSecretRefs: [
                    {
                      name: 'generated_signing',
                      source: 'generated',
                      binding: 'receiver_trigger',
                      encoding: 'utf8'
                    },
                    {
                      name: 'imported_registration',
                      source: 'registration',
                      registrationKey: 'registration.secret',
                      encoding: 'utf8'
                    }
                  ],
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
    let configSchema = await f.slateConfigSchema.default({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      overrides: {
        schema: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: { token: { type: 'string', writeOnly: true } }
            }
          }
        }
      }
    });
    let instanceConfig = await f.slateInstanceConfig.default({
      instanceOid: instance.oid,
      schemaOid: configSchema.oid,
      tenantOid: tenant.oid,
      value: { nested: { token: 'legacy-token' } }
    });
    await testDb.slateInstance.update({
      where: { oid: instance.oid },
      data: { currentConfigOid: instanceConfig.oid }
    });

    let signed = signedSecretClient();
    let generated = await signed.generateDeclaredTriggerSecret({
      receiverTriggerId: receiverTrigger.id,
      name: 'generated_signing'
    });
    let imported = await signed.importDeclaredTriggerSecret({
      receiverTriggerId: receiverTrigger.id,
      name: 'imported_registration',
      value: 'imported-registration-secret'
    });
    let config = await signed.importInstanceConfig({
      slateInstanceConfigId: instanceConfig.id,
      path: 'nested/token',
      value: 'updated-nested-secret'
    });

    for (const mutation of [generated, imported, config]) {
      expect(mutation).not.toHaveProperty('secretIssuanceReceipt');
      expect(JSON.stringify(mutation)).not.toMatch(
        /encryptedValue|lookupHash|plaintext|imported-registration-secret|updated-nested-secret/
      );
    }
    expect(
      await testDb.secretIssuanceReceipt.count({
        where: {
          secretId: { in: [generated.secret.id, imported.secret.id, config.secret.id] }
        }
      })
    ).toBe(0);
    for (const secretId of [generated.secret.id, imported.secret.id, config.secret.id]) {
      await expect(
        signed.consumeReceiverPathReceipt({
          ...callbackAuthority,
          receiptId: secretId,
          receiptToken: 'not-an-issued-path-token'
        })
      ).rejects.toThrow();
    }

    let metadata = await signed.resolveDeclaredTriggerSecretMetadata({
      receiverTriggerId: receiverTrigger.id,
      name: 'generated_signing'
    });
    let ordinaryGet = await slatesHubClient.slateTriggerReceiver.get({
      tenantId: tenant.id,
      slateTriggerReceiverId: receiver.id
    });
    let ordinaryList = await slatesHubClient.slateTriggerReceiver.list({
      tenantId: tenant.id,
      limit: 10
    });
    for (const response of [metadata, ordinaryGet, ordinaryList]) {
      expect(JSON.stringify(response)).not.toMatch(
        /encryptedValue|lookupHash|plaintext|imported-registration-secret|updated-nested-secret/
      );
    }
    expect(metadata).toEqual([
      expect.objectContaining({
        id: generated.secret.id,
        status: 'active',
        secretVersion: 1,
        specHash,
        sourceBindingType: 'generated'
      })
    ]);
  });

  it('denies unknown receiver and undeclared published-spec lifecycle bindings', async () => {
    let { receiverTrigger } = await f.slateTriggerReceiver.complete();
    let signed = signedSecretClient();
    await expect(
      signed.createReceiverPath({
        tenantId: 'tenant-cross-tenant-or-missing',
        receiverId: 'receiver-cross-tenant-or-missing',
        callbackId: 'callback-wrong',
        callbackInstanceId: 'callback-instance-wrong',
        receiverAuthorityVersion: 1,
        trustedActorId: 'actor-e2e',
        requestId: 'request-e2e'
      })
    ).rejects.toThrow();
    await expect(
      signed.generateDeclaredTriggerSecret({
        receiverTriggerId: receiverTrigger.id,
        name: 'undeclared-secret-ref'
      })
    ).rejects.toThrow();
  });
});

describe('Task 8 truthful registration production DB boundary E2E', () => {
  let f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('fences callback receiver ownership for upsert, replacement, delete, and idempotent retries', async () => {
    let {
      tenant,
      instance,
      triggerAction,
      slate,
      receiver: foreignReceiver
    } = await f.slateTriggerReceiver.complete({ slateIdentifier: 'task8-callback-owner' });
    let deploymentProvider = await f.deploymentProvider.default();
    await f.slateDeployment.succeeded({
      slateVersionOid: slate.currentVersion.oid,
      slateOid: slate.oid,
      providerOid: deploymentProvider.oid
    });
    let configSchema = await f.slateConfigSchema.default({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      overrides: { schema: { type: 'object', properties: {} } }
    });
    let instanceConfig = await f.slateInstanceConfig.default({
      instanceOid: instance.oid,
      schemaOid: configSchema.oid,
      tenantOid: tenant.oid,
      value: {}
    });
    await testDb.slateInstance.update({
      where: { oid: instance.oid },
      data: { currentConfigOid: instanceConfig.oid }
    });
    let initialRequest = {
      tenantId: tenant.id,
      callbackId: 'callback-owner-e2e',
      callbackInstanceId: 'callback-instance-owner-e2e',
      expectedSlateTriggerReceiverId: null,
      expectedOwnerVersion: 0,
      ownerMutationId: 'callback-owner-create-v1',
      slateInstanceId: instance.id,
      authConfigId: null,
      triggers: [{ triggerId: triggerAction.id, eventTypes: ['event.created'] }]
    };
    let created = await slatesHubClient.callbackRegistration.upsert(initialRequest);
    expect(created).toMatchObject({
      callbackOwnerVersion: 1,
      triggers: [expect.objectContaining({ eventTypes: ['event.created'] })]
    });

    let beforeRejectedUpsert = await testDb.slateTriggerReceiver.findUniqueOrThrow({
      where: { id: created.id },
      include: { triggers: true }
    });
    await expect(
      slatesHubClient.callbackRegistration.upsert({
        ...initialRequest,
        expectedSlateTriggerReceiverId: foreignReceiver.id,
        expectedOwnerVersion: 0,
        ownerMutationId: 'callback-owner-foreign-replacement'
      })
    ).rejects.toThrow();
    await expect(
      slatesHubClient.callbackRegistration.upsert({
        ...initialRequest,
        expectedSlateTriggerReceiverId: created.id,
        expectedOwnerVersion: 0,
        ownerMutationId: 'callback-owner-stale-upsert'
      })
    ).rejects.toThrow();
    expect(
      await testDb.slateTriggerReceiver.findUniqueOrThrow({
        where: { id: created.id },
        include: { triggers: true }
      })
    ).toEqual(beforeRejectedUpsert);

    let currentRequest = {
      ...initialRequest,
      expectedSlateTriggerReceiverId: created.id,
      expectedOwnerVersion: 1,
      ownerMutationId: 'callback-owner-update-v2'
    };
    let updated = await slatesHubClient.callbackRegistration.upsert(currentRequest);
    expect(updated).toMatchObject({ id: created.id, callbackOwnerVersion: 2 });
    await expect(
      slatesHubClient.callbackRegistration.upsert(currentRequest)
    ).resolves.toMatchObject({ id: created.id, callbackOwnerVersion: 2 });

    let beforeRejectedDelete = await testDb.slateTriggerReceiver.findUniqueOrThrow({
      where: { id: created.id },
      include: { triggers: true }
    });
    await expect(
      slatesHubClient.callbackRegistration.delete({
        tenantId: tenant.id,
        callbackId: initialRequest.callbackId,
        callbackInstanceId: initialRequest.callbackInstanceId,
        slateTriggerReceiverId: foreignReceiver.id,
        expectedOwnerVersion: 2,
        ownerMutationId: 'callback-owner-stale-delete'
      })
    ).rejects.toThrow();
    expect(
      await testDb.slateTriggerReceiver.findUniqueOrThrow({
        where: { id: created.id },
        include: { triggers: true }
      })
    ).toEqual(beforeRejectedDelete);

    let deleteRequest = {
      tenantId: tenant.id,
      callbackId: initialRequest.callbackId,
      callbackInstanceId: initialRequest.callbackInstanceId,
      slateTriggerReceiverId: created.id,
      expectedOwnerVersion: 2,
      ownerMutationId: 'callback-owner-delete-v3'
    };
    let deleted = await slatesHubClient.callbackRegistration.delete(deleteRequest);
    expect(deleted).toMatchObject({
      id: created.id,
      callbackOwnerVersion: 3,
      status: SlateTriggerReceiverStatus.paused
    });
    await expect(
      slatesHubClient.callbackRegistration.delete(deleteRequest)
    ).resolves.toMatchObject({ id: created.id, callbackOwnerVersion: 3 });
  });

  it('persists register, re-register, renew, unregister, and delete generations with durable intents', async () => {
    let { receiver, receiverTrigger } = await f.slateTriggerReceiver.complete();
    await testDb.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        source: SlateTriggerReceiverTriggerSource.webhook,
        registrationStatus: 'pending',
        registrationIntentKind: 'register',
        registrationGeneration: 1,
        registrationTransitionVersion: 0,
        registrationLeaseToken: null,
        registrationLeaseExpiresAt: null,
        remoteRegistrationKnown: false
      }
    });

    for (const intent of [
      'register',
      'reregister',
      'renew',
      'unregister',
      'delete'
    ] as const) {
      await testDb.$transaction(async tx => {
        await beginRegistrationIntentInTransaction({
          tx,
          receiverTriggerId: receiverTrigger.id,
          intent,
          tombstone: intent === 'delete'
        });
      });
    }

    let persisted = await testDb.slateTriggerReceiverTrigger.findUniqueOrThrow({
      where: { oid: receiverTrigger.oid }
    });
    expect(persisted).toMatchObject({
      registrationGeneration: 6,
      registrationIntentKind: 'delete',
      registrationStatus: 'unregistering',
      tombstonedAt: expect.any(Date),
      ingressDisabledAt: expect.any(Date)
    });
    expect(
      await testDb.slateTriggerRegistrationOutbox.count({
        where: { receiverTriggerOid: receiverTrigger.oid }
      })
    ).toBe(5);
    expect(
      await testDb.slateTriggerReceiver.findUniqueOrThrow({ where: { oid: receiver.oid } })
    ).toBeTruthy();
  });

  it('fences an equality-expired old owner, stores closed failure, and retains known remote cleanup truth', async () => {
    let first = await f.slateTriggerReceiver.complete({
      slateIdentifier: 'task8-lease-first'
    });
    let now = new Date('2026-08-14T12:00:00.000Z');
    await testDb.slateTriggerReceiverTrigger.update({
      where: { oid: first.receiverTrigger.oid },
      data: {
        source: SlateTriggerReceiverTriggerSource.webhook,
        registrationStatus: 'pending',
        registrationIntentKind: 'register',
        registrationGeneration: 1,
        registrationTransitionVersion: 0,
        registrationLeaseToken: null,
        registrationLeaseExpiresAt: null
      }
    });
    let oldOwner = await slateTriggerRegistrationLifecycleService.claim({
      receiverTriggerId: first.receiverTrigger.id,
      registrationGeneration: 1,
      operation: 'register',
      now
    });
    expect(oldOwner).not.toBeNull();
    await testDb.slateTriggerReceiverTrigger.update({
      where: { oid: first.receiverTrigger.oid },
      data: { registrationLeaseExpiresAt: now }
    });
    let currentOwner = await slateTriggerRegistrationLifecycleService.claim({
      receiverTriggerId: first.receiverTrigger.id,
      registrationGeneration: 1,
      operation: 'register',
      now
    });
    expect(currentOwner?.registrationLeaseToken).not.toBe(oldOwner?.registrationLeaseToken);
    await expect(
      slateTriggerRegistrationLifecycleService.fail({
        ...oldOwner!,
        code: 'provider_timeout',
        now
      })
    ).resolves.toBe(false);
    await expect(
      slateTriggerRegistrationLifecycleService.fail({
        ...currentOwner!,
        code: 'provider_timeout',
        now
      })
    ).resolves.toBe(true);

    await testDb.slateTriggerReceiver.update({
      where: { oid: first.receiver.oid },
      data: {
        tombstonedAt: new Date(now.getTime() - TRIGGER_RECEIVER_FINAL_RETENTION_MS - 1)
      }
    });
    await testDb.slateTriggerReceiverTrigger.update({
      where: { oid: first.receiverTrigger.oid },
      data: { registrationStatus: 'unregistered', remoteRegistrationKnown: true }
    });
    await finalizeTruthfulTriggerReceiverCleanup({ now });
    expect(
      await testDb.slateTriggerReceiver.count({ where: { oid: first.receiver.oid } })
    ).toBe(1);
    await testDb.slateTriggerReceiverTrigger.update({
      where: { oid: first.receiverTrigger.oid },
      data: { remoteRegistrationKnown: false }
    });
    await finalizeTruthfulTriggerReceiverCleanup({ now });
    expect(
      await testDb.slateTriggerReceiver.count({ where: { oid: first.receiver.oid } })
    ).toBe(0);
  });

  it('rolls receiver and trigger mutations back together and aggregates two trigger intents', async () => {
    let { receiver, receiverTrigger, triggerAction, slate, tenant } =
      await f.slateTriggerReceiver.complete({ slateIdentifier: 'task8-atomic-upsert' });
    let before = await testDb.slateTriggerReceiver.findUniqueOrThrow({
      where: { oid: receiver.oid }
    });
    await expect(
      slateTriggerReceiverService.updateTriggerReceiver({
        tenant,
        receiverId: receiver.id,
        input: {
          name: 'must-roll-back',
          triggers: [{ triggerId: triggerAction.id, state: { invalid: 1n } as any }]
        }
      })
    ).rejects.toThrow();
    let rolledBack = await testDb.slateTriggerReceiver.findUniqueOrThrow({
      where: { oid: receiver.oid },
      include: { triggers: true }
    });
    expect(rolledBack.name).toBe(before.name);
    expect(rolledBack.triggers[0]?.registrationGeneration).toBe(
      receiverTrigger.registrationGeneration
    );

    let secondAction = await f.slateSpecification.withTriggerAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid
    });
    await slateTriggerReceiverService.updateTriggerReceiver({
      tenant,
      receiverId: receiver.id,
      input: {
        triggers: [
          { triggerId: triggerAction.id, state: {} },
          { triggerId: secondAction.id, state: {} }
        ]
      }
    });
    let multi = await testDb.slateTriggerReceiver.findUniqueOrThrow({
      where: { oid: receiver.oid },
      include: { triggers: true }
    });
    expect(multi.triggers).toHaveLength(2);
    expect(new Set(multi.triggers.map(trigger => trigger.actionOid)).size).toBe(2);
  });

  it('keeps an unchanged trigger generation stable and tombstones a removal with one intent', async () => {
    let { receiver, receiverTrigger, triggerAction, tenant } =
      await f.slateTriggerReceiver.complete({ slateIdentifier: 'task8-unchanged-removal' });
    await testDb.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        source: SlateTriggerReceiverTriggerSource.webhook,
        registrationStatus: 'registered',
        registrationIntentKind: 'register',
        registrationGeneration: 3,
        registrationTransitionVersion: 2
      }
    });

    await slateTriggerReceiverService.updateTriggerReceiver({
      tenant,
      receiverId: receiver.id,
      input: {
        triggers: [{ triggerId: triggerAction.id, state: receiverTrigger.state as any }]
      }
    });
    expect(
      await testDb.slateTriggerReceiverTrigger.findUniqueOrThrow({
        where: { oid: receiverTrigger.oid },
        select: { registrationGeneration: true }
      })
    ).toEqual({ registrationGeneration: 3 });
    expect(
      await testDb.slateTriggerRegistrationOutbox.count({
        where: { receiverTriggerOid: receiverTrigger.oid }
      })
    ).toBe(0);

    await slateTriggerReceiverService.updateTriggerReceiver({
      tenant,
      receiverId: receiver.id,
      input: { triggers: [] }
    });
    expect(
      await testDb.slateTriggerReceiverTrigger.findUniqueOrThrow({
        where: { oid: receiverTrigger.oid },
        select: {
          registrationGeneration: true,
          registrationStatus: true,
          tombstonedAt: true,
          ingressDisabledAt: true
        }
      })
    ).toEqual({
      registrationGeneration: 4,
      registrationStatus: 'unregistering',
      tombstonedAt: expect.any(Date),
      ingressDisabledAt: expect.any(Date)
    });
    expect(
      await testDb.slateTriggerRegistrationOutbox.count({
        where: { receiverTriggerOid: receiverTrigger.oid }
      })
    ).toBe(1);
  });

  it('serializes concurrent re-registration mutations without losing generations', async () => {
    let { receiver, receiverTrigger, triggerAction, tenant } =
      await f.slateTriggerReceiver.complete({ slateIdentifier: 'task8-reregister-race' });
    await testDb.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        source: SlateTriggerReceiverTriggerSource.webhook,
        registrationStatus: 'registered',
        registrationIntentKind: 'register',
        registrationGeneration: 6,
        registrationTransitionVersion: 1
      }
    });

    await Promise.allSettled(
      [1, 2].map(cursor =>
        slateTriggerReceiverService.updateTriggerReceiver({
          tenant,
          receiverId: receiver.id,
          input: { triggers: [{ triggerId: triggerAction.id, state: { cursor } }] }
        })
      )
    );
    let persisted = await testDb.slateTriggerReceiverTrigger.findUniqueOrThrow({
      where: { oid: receiverTrigger.oid },
      select: { registrationGeneration: true }
    });
    expect(persisted.registrationGeneration).toBeGreaterThanOrEqual(7);
    expect(persisted.registrationGeneration).toBeLessThanOrEqual(8);
    let outboxCount = await testDb.slateTriggerRegistrationOutbox.count({
      where: { receiverTriggerOid: receiverTrigger.oid }
    });
    expect(outboxCount).toBe(persisted.registrationGeneration - 6);
  });
});
