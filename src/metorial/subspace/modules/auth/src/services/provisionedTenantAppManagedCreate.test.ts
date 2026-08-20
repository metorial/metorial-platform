import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.DATABASE_URL ??= 'postgres://user:pass@127.0.0.1:5432/task13';
process.env.PUBLIC_SERVICE_URL ??= 'http://subspace.test';
process.env.ENCRYPTION_KEY ??= 'task13-managed-create-key';

let state = vi.hoisted(() => ({
  nextOid: 100n,
  route: null as any,
  binding: null as any,
  sources: [] as any[],
  backingSecrets: [] as any[],
  outboxes: [] as any[],
  tombstones: [] as any[],
  failOutboxAt: null as number | null,
  outboxCreateCount: 0
}));

let tenant = { oid: 7n, id: 'tenant-1', slateTenantId: 'hub-tenant-1' };
let callbackInstance = {
  oid: 8n,
  id: 'callback-1',
  callback: { tenantOid: tenant.oid }
};
let replacementCallbackInstance = {
  oid: 18n,
  id: 'callback-2',
  callback: { tenantOid: tenant.oid }
};
let tenantCredential = {
  oid: 22n,
  id: 'tenant-credential-1',
  tenantOid: tenant.oid,
  solutionOid: 3,
  status: 'active',
  origin: 'tenant_created',
  provider: { identifier: 'github' }
};
let providerAuthCredentials = { oid: 12n, id: 'managed-backing-1', status: 'active' };
let backing = {
  oid: 11n,
  managedCredentialsOid: 10n,
  tenantOid: tenant.oid,
  tenant,
  providerAuthCredentialsOid: providerAuthCredentials.oid,
  providerAuthCredentials,
  managedCredentials: { id: 'managed-owner-1' }
};
let managedOwner = {
  oid: 10n,
  id: 'managed-owner-1',
  status: 'active',
  solutionOid: 3,
  provider: { id: 'provider-github', identifier: 'github' },
  initialProviderAuthMethod: {
    id: 'method-github',
    provider: { id: 'provider-github', identifier: 'github' }
  },
  backings: [backing]
};

vi.mock('@metorial-subspace/db', () => {
  let tx: any = {
    tenant: { findUnique: vi.fn(async () => tenant) },
    callbackInstance: {
      findUnique: vi.fn(async ({ where }: any) =>
        where.id === replacementCallbackInstance.id
          ? replacementCallbackInstance
          : where.id === callbackInstance.id
            ? callbackInstance
            : null
      )
    },
    provisionedVendorAppRoute: {
      findUnique: vi.fn(async () => state.route),
      findUniqueOrThrow: vi.fn(async () => state.route),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (state.route.oid !== where.oid || state.route.generation !== where.generation) {
          return { count: 0 };
        }
        Object.assign(state.route, data);
        return { count: 1 };
      })
    },
    managedProviderAuthCredentials: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === managedOwner.id && where.solutionOid === managedOwner.solutionOid
          ? managedOwner
          : null
      ),
      findUnique: vi.fn(async () => ({
        ...managedOwner,
        backings: [{ ...backing, secrets: state.backingSecrets }]
      }))
    },
    providerAuthCredentials: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === tenantCredential.id &&
        where.tenantOid === tenantCredential.tenantOid &&
        where.solutionOid === tenantCredential.solutionOid
          ? tenantCredential
          : null
      ),
      findUnique: vi.fn(async ({ where }: any) =>
        where.id === tenantCredential.id ? tenantCredential : null
      )
    },
    provisionedTenantApp: {
      findFirst: vi.fn(async () => state.binding),
      findUnique: vi.fn(async ({ where }: any) =>
        state.binding?.id === where.id ? state.binding : null
      ),
      create: vi.fn(async ({ data }: any) => {
        if (state.binding?.deletedAt) state.tombstones.push(structuredClone(state.binding));
        let selectedCallback =
          data.callbackInstanceOid === replacementCallbackInstance.oid
            ? replacementCallbackInstance
            : callbackInstance;
        state.binding = {
          ...data,
          externalAppId: data.externalAppId ?? null,
          externalAccountId: data.externalAccountId ?? null,
          externalInstallationId: data.externalInstallationId ?? null,
          externalOwnershipKey: data.externalOwnershipKey ?? null,
          retainedExternalOwnershipKey: data.retainedExternalOwnershipKey ?? null,
          ownerIdentity: data.ownerIdentity ?? null,
          githubManifestStateHash: null,
          githubManifestStateExpiresAt: null,
          githubManifestCompletedAt: null,
          githubInstallationCompletedAt: null,
          deletedAt: null,
          tenant,
          callbackInstance: selectedCallback,
          vendorAppRoute: state.route
        };
        return state.binding;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (
          !state.binding ||
          state.binding.oid !== where.oid ||
          state.binding.generation !== where.generation ||
          state.binding.deletedAt !== null
        ) {
          return { count: 0 };
        }
        Object.assign(state.binding, data);
        return { count: 1 };
      }),
      findMany: vi.fn(async () => (state.binding?.deletedAt ? [] : [state.binding]))
    },
    provisionedAppProjectionOutbox: {
      create: vi.fn(async ({ data }: any) => {
        state.outboxCreateCount++;
        if (state.failOutboxAt === state.outboxCreateCount) {
          throw new Error('simulated replacement outbox failure');
        }
        state.outboxes.push(data);
        return data;
      })
    },
    managedProviderAuthCredentialSecret: {
      findFirst: vi.fn(
        async ({ where }: any) =>
          state.sources
            .filter(row => row.purpose === where.purpose)
            .sort((left, right) => right.secretVersion - left.secretVersion)[0] ?? null
      ),
      create: vi.fn(async ({ data }: any) => {
        let row = { ...data, validUntil: null, rotatedAt: null, revokedAt: null };
        state.sources.push(row);
        return row;
      }),
      updateMany: vi.fn(async () => ({ count: 0 }))
    },
    managedProviderAuthCredentialsBackingSecret: {
      findFirst: vi.fn(
        async ({ where }: any) =>
          state.backingSecrets
            .filter(row => row.purpose === where.purpose)
            .sort((left, right) => right.secretVersion - left.secretVersion)[0] ?? null
      ),
      create: vi.fn(async ({ data }: any) => {
        let row = { ...data, validUntil: null, rotatedAt: null, revokedAt: null };
        state.backingSecrets.push(row);
        return row;
      }),
      updateMany: vi.fn(async () => ({ count: 0 }))
    },
    managedProviderAuthCredentialsBacking: {
      update: vi.fn(async () => backing)
    }
  };
  return {
    db: tx,
    getId: (kind: string) => ({ oid: state.nextOid++, id: `${kind}-${state.nextOid}` }),
    withTransaction: async (run: (transaction: unknown) => unknown) => {
      let snapshot = structuredClone({
        route: state.route,
        binding: state.binding,
        sources: state.sources,
        backingSecrets: state.backingSecrets,
        outboxes: state.outboxes,
        tombstones: state.tombstones,
        outboxCreateCount: state.outboxCreateCount
      });
      try {
        return await run(tx);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
    addAfterTransactionHook: vi.fn()
  };
});

let {
  buildProvisionedExternalOwnershipKey,
  configureProvisionedByoCredentialSecretAuthorityResolver,
  configureProvisionedExternalOwnershipVerifier,
  provisionedTenantAppService
} = await import('./provisionedTenantApp');

let createInput = () => ({
  tenantId: tenant.id,
  callbackInstanceId: callbackInstance.id,
  provisionedRouteId: state.route.id,
  expectedRouteGeneration: state.route.generation,
  hubReceiverId: 'receiver-1',
  hubReceiverGeneration: 4,
  hubReceiverTriggerId: 'trigger-1',
  triggerActionId: 'events',
  triggerSpecHash: 'a'.repeat(64),
  credentialOwnerType: 'managed' as const,
  managedProviderAuthCredentialsId: managedOwner.id,
  credentialOwnerRef: managedOwner.id,
  credentialSecretValue: 'route-vendor-material-v5'
});

describe('managed provisioned-app production create path', () => {
  beforeEach(() => {
    state.nextOid = 100n;
    state.binding = null;
    state.sources = [];
    state.backingSecrets = [];
    state.outboxes = [];
    state.tombstones = [];
    state.failOutboxAt = null;
    state.outboxCreateCount = 0;
    state.route = {
      oid: 9n,
      id: 'route-1',
      vendor: 'github',
      purpose: 'shared_provisioned_app',
      routeIdentifier: 'selector-1',
      generation: 5,
      credentialOwnerRef: managedOwner.id,
      routeSecretId: 'route-path-v5',
      routeSecretVersion: 5,
      vendorVerificationSecretId: 'route-vendor-v5',
      vendorVerificationVersion: 5,
      status: 'active',
      projectionDigest: 'route-digest',
      expiresAt: null,
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
      updatedAt: new Date('2026-08-15T00:00:00.000Z'),
      deletedAt: null
    };
    configureProvisionedExternalOwnershipVerifier({
      verify: vi.fn(async () => ({
        externalAppId: 'github-app-1',
        externalAccountId: 'github-account-1',
        externalInstallationId: 'github-installation-1',
        ownerIdentity: 'organization:metorial'
      }))
    });
  });

  it('inherits route authority, writes the managed backing, activates, and tombstones on rotation', async () => {
    let created = await provisionedTenantAppService.createProvisionedTenantApp({
      solution: { oid: 3 } as never,
      input: createInput()
    });
    expect(created.binding).toMatchObject({
      credentialSecretId: state.route.vendorVerificationSecretId,
      credentialVersion: state.route.vendorVerificationVersion,
      credentialSecretPurpose: 'vendor_verification',
      status: 'pending'
    });
    expect(created.secret).toEqual({
      id: state.route.vendorVerificationSecretId,
      secretVersion: state.route.vendorVerificationVersion,
      status: 'active'
    });
    expect(state.sources[0]).toMatchObject({
      purpose: 'vendor_verification',
      secretVersion: 5
    });
    expect(state.backingSecrets[0]).toMatchObject({
      id: 'route-vendor-v5',
      purpose: 'vendor_verification',
      tenantOid: tenant.oid,
      secretVersion: 5
    });
    expect(
      JSON.stringify({
        secret: created.secret,
        payloads: state.outboxes.map(row => row.payload)
      })
    ).not.toContain('route-vendor-material-v5');
    expect(created.secretIssuanceReceipt).toBeNull();

    let activated = await provisionedTenantAppService.activateProvisionedTenantApp({
      provisionedTenantAppId: created.binding.id,
      expectedGeneration: 1,
      ownershipProof: { signed: true }
    });
    expect(activated.binding).toMatchObject({
      generation: 2,
      status: 'active',
      credentialSecretId: 'route-vendor-v5',
      credentialVersion: 5
    });
    expect(state.outboxes.at(-1)?.payload).toMatchObject({
      credentialSecretId: 'route-vendor-v5',
      credentialVersion: 5,
      status: 'active'
    });

    let rebound = await provisionedTenantAppService.rebindProvisionedTenantApp({
      provisionedTenantAppId: activated.binding.id,
      expectedGeneration: 2,
      expectedRouteGeneration: 5,
      input: {
        callbackInstanceId: replacementCallbackInstance.id,
        hubReceiverId: 'receiver-1',
        hubReceiverGeneration: 5,
        hubReceiverTriggerId: 'trigger-1',
        triggerActionId: 'events',
        triggerSpecHash: 'b'.repeat(64)
      }
    });
    expect(state.tombstones).toHaveLength(1);
    expect(state.tombstones[0]).toMatchObject({
      id: activated.binding.id,
      generation: 3,
      status: 'tombstoned',
      retainedExternalOwnershipKey: expect.stringMatching(/^peo1:/)
    });
    expect(rebound.binding).toMatchObject({
      generation: 4,
      status: 'active',
      callbackInstanceOid: replacementCallbackInstance.oid,
      credentialSecretId: state.route.vendorVerificationSecretId,
      credentialVersion: state.route.vendorVerificationVersion
    });
    expect(state.outboxes.slice(-2).map(row => row.payload.status)).toEqual([
      'tombstoned',
      'active'
    ]);

    await provisionedTenantAppService.activateProvisionedVendorAppRoute({
      provisionedRouteId: state.route.id,
      expectedGeneration: 5,
      routeSecretId: 'route-path-v6',
      routeSecretVersion: 6,
      vendorVerificationSecretId: 'route-vendor-v6',
      vendorVerificationVersion: 6
    });
    expect(state.binding).toMatchObject({ status: 'tombstoned', deletedAt: expect.any(Date) });
  });

  it('rejects a stale route CAS before creating a binding or managed secret', async () => {
    await expect(
      provisionedTenantAppService.createProvisionedTenantApp({
        solution: { oid: 3 } as never,
        input: { ...createInput(), expectedRouteGeneration: 4 }
      })
    ).rejects.toMatchObject({ code: 'route_authority_invalid' });
    expect(state.binding).toBeNull();
    expect(state.sources).toEqual([]);
    expect(state.backingSecrets).toEqual([]);
    expect(state.outboxes).toEqual([]);
  });

  it('rejects a stale route generation before tombstoning an active managed binding', async () => {
    let created = await provisionedTenantAppService.createProvisionedTenantApp({
      solution: { oid: 3 } as never,
      input: createInput()
    });
    let activated = await provisionedTenantAppService.activateProvisionedTenantApp({
      provisionedTenantAppId: created.binding.id,
      expectedGeneration: 1,
      ownershipProof: { signed: true }
    });
    let before = structuredClone({
      binding: state.binding,
      outboxes: state.outboxes,
      tombstones: state.tombstones
    });
    await expect(
      provisionedTenantAppService.rebindProvisionedTenantApp({
        provisionedTenantAppId: activated.binding.id,
        expectedGeneration: 2,
        expectedRouteGeneration: 4,
        input: {
          callbackInstanceId: replacementCallbackInstance.id,
          hubReceiverId: 'receiver-1',
          hubReceiverGeneration: 5,
          hubReceiverTriggerId: 'trigger-1',
          triggerActionId: 'events',
          triggerSpecHash: 'b'.repeat(64)
        }
      })
    ).rejects.toMatchObject({ code: 'route_authority_invalid' });
    expect(state.binding).toEqual(before.binding);
    expect(state.outboxes).toEqual(before.outboxes);
    expect(state.tombstones).toEqual(before.tombstones);
  });

  it('keeps a BYO replacement pending through writer failure and idempotent retry before activation', async () => {
    let ownership = {
      externalAppId: 'github-app-1',
      externalAccountId: 'github-account-1',
      externalInstallationId: 'github-installation-1',
      ownerIdentity: 'organization:metorial'
    };
    let externalOwnershipKey = buildProvisionedExternalOwnershipKey({
      vendor: 'github',
      ...ownership
    });
    state.binding = {
      oid: 41n,
      id: 'binding-byo-old',
      tenantOid: tenant.oid,
      callbackInstanceOid: callbackInstance.oid,
      vendorAppRouteOid: state.route.oid,
      hubReceiverId: 'receiver-1',
      hubReceiverGeneration: 4,
      hubReceiverTriggerId: 'trigger-1',
      triggerActionId: 'events',
      triggerSpecHash: 'a'.repeat(64),
      vendor: 'github',
      purpose: 'shared_provisioned_app',
      ...ownership,
      externalOwnershipKey,
      retainedExternalOwnershipKey: null,
      credentialOwnerType: 'byo',
      managedCredentialsOid: null,
      credentialOwnerRef: tenantCredential.id,
      credentialSecretId: 'old-byo-secret',
      credentialSecretPurpose: 'vendor_verification',
      credentialVersion: 1,
      generation: 4,
      status: 'active',
      projectionDigest: 'old-active-digest',
      correlationId: 'old-correlation',
      expiresAt: null,
      githubManifestStateHash: null,
      githubManifestStateExpiresAt: null,
      githubManifestCompletedAt: new Date('2026-08-15T00:00:00.000Z'),
      githubInstallationCompletedAt: new Date('2026-08-15T00:01:00.000Z'),
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
      updatedAt: new Date('2026-08-15T00:01:00.000Z'),
      deletedAt: null,
      tenant,
      callbackInstance,
      vendorAppRoute: state.route
    };

    let rebound = await provisionedTenantAppService.rebindProvisionedTenantApp({
      provisionedTenantAppId: 'binding-byo-old',
      expectedGeneration: 4,
      expectedRouteGeneration: 5,
      input: {
        callbackInstanceId: replacementCallbackInstance.id,
        hubReceiverId: 'receiver-1',
        hubReceiverGeneration: 5,
        hubReceiverTriggerId: 'trigger-1',
        triggerActionId: 'events',
        triggerSpecHash: 'b'.repeat(64)
      }
    });
    expect(state.tombstones[0]).toMatchObject({
      id: 'binding-byo-old',
      generation: 5,
      status: 'tombstoned',
      retainedExternalOwnershipKey: externalOwnershipKey
    });
    expect(rebound.binding).toMatchObject({
      generation: 6,
      status: 'pending',
      externalOwnershipKey,
      credentialVersion: 2
    });
    expect(rebound.binding.credentialSecretId).not.toBe('old-byo-secret');
    expect(state.outboxes.slice(-2).map(row => row.payload.status)).toEqual([
      'tombstoned',
      'pending'
    ]);

    let writerCalls = 0;
    let writer = {
      createOrRotate: vi.fn(async ({ provisionedTenantAppId }: any) => {
        writerCalls++;
        expect(provisionedTenantAppId).toBe(rebound.binding.id);
        if (writerCalls === 1) throw new Error('simulated signed Hub writer failure');
        return {
          secret: {
            id: rebound.binding.credentialSecretId!,
            secretVersion: rebound.binding.credentialVersion,
            status: 'active'
          },
          auditCorrelationId: 'hub-audit-correlation',
          idempotent: writerCalls > 2,
          secretIssuanceReceipt: null
        };
      }),
      validate: vi.fn().mockResolvedValue({ valid: true }),
      revoke: vi.fn()
    };
    configureProvisionedByoCredentialSecretAuthorityResolver(writer);
    let writeInput = {
      solution: { oid: 3 } as never,
      provisionedTenantAppId: rebound.binding.id,
      expectedGeneration: 6,
      importedValue: 'replacement-imported-material'
    };
    await expect(
      provisionedTenantAppService.createOrRotateProvisionedTenantCredentialSecret(writeInput)
    ).rejects.toThrow('simulated signed Hub writer failure');
    expect(state.binding).toMatchObject({ generation: 6, status: 'pending' });

    state.failOutboxAt = state.outboxCreateCount + 1;
    await expect(
      provisionedTenantAppService.createOrRotateProvisionedTenantCredentialSecret(writeInput)
    ).rejects.toThrow('simulated replacement outbox failure');
    expect(state.binding).toMatchObject({ generation: 6, status: 'pending' });

    state.failOutboxAt = null;
    let written =
      await provisionedTenantAppService.createOrRotateProvisionedTenantCredentialSecret(
        writeInput
      );
    expect(written).toMatchObject({
      binding: { generation: 7, status: 'pending' },
      idempotent: true,
      secretIssuanceReceipt: null
    });
    expect(writer.createOrRotate).toHaveBeenCalledTimes(3);

    configureProvisionedExternalOwnershipVerifier({
      verify: vi.fn(async () => ({ ...ownership, externalAppId: 'wrong-app' }))
    });
    await expect(
      provisionedTenantAppService.activateProvisionedTenantApp({
        provisionedTenantAppId: rebound.binding.id,
        expectedGeneration: 7,
        ownershipProof: { signed: false }
      })
    ).rejects.toMatchObject({ code: 'external_ownership_immutable' });
    expect(state.binding).toMatchObject({ generation: 7, status: 'pending' });

    configureProvisionedExternalOwnershipVerifier({ verify: vi.fn(async () => ownership) });
    let activated = await provisionedTenantAppService.activateProvisionedTenantApp({
      provisionedTenantAppId: rebound.binding.id,
      expectedGeneration: 7,
      ownershipProof: { signed: true }
    });
    expect(activated.binding).toMatchObject({
      generation: 8,
      status: 'active',
      externalOwnershipKey,
      credentialSecretId: rebound.binding.credentialSecretId,
      credentialVersion: 2
    });
    expect(writer.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        provisionedTenantAppId: rebound.binding.id,
        credentialSecretId: rebound.binding.credentialSecretId,
        credentialVersion: 2,
        credentialSecretPurpose: 'vendor_verification'
      })
    );
    expect(
      JSON.stringify(
        { rebound, written, activated, outboxes: state.outboxes },
        (_key, value) => (typeof value === 'bigint' ? value.toString() : value)
      )
    ).not.toContain('replacement-imported-material');
  });
});
