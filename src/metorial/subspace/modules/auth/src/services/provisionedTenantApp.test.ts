import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.DATABASE_URL ??= 'postgres://user:pass@127.0.0.1:5432/task13';
process.env.PUBLIC_SERVICE_URL ??= 'http://subspace.test';
process.env.ENCRYPTION_KEY ??= 'task13-test-encryption-key';
process.env.SLACK_MANAGER_APP_PROVISIONING_ENABLED = 'false';

let serviceState = vi.hoisted(() => ({
  binding: null as any,
  route: null as any,
  providerAuthCredential: null as any,
  outboxes: [] as any[],
  failOutboxAt: null as number | null,
  outboxCreateCount: 0,
  tx: null as any,
  nextId: 1
}));

vi.mock('@metorial-subspace/db', () => {
  let tx: any = {
    provisionedTenantApp: {
      findUnique: vi.fn(async ({ where }: any) =>
        serviceState.binding?.id === where.id ? serviceState.binding : null
      ),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (
          !serviceState.binding ||
          serviceState.binding.oid !== where.oid ||
          serviceState.binding.generation !== where.generation ||
          serviceState.binding.deletedAt !== null
        ) {
          return { count: 0 };
        }
        Object.assign(serviceState.binding, data);
        return { count: 1 };
      }),
      findMany: vi.fn(async ({ where }: any) => {
        if (!serviceState.binding || serviceState.binding.deletedAt !== null) return [];
        if (
          where.vendorAppRouteOid !== undefined &&
          serviceState.binding.vendorAppRouteOid === where.vendorAppRouteOid
        ) {
          return [serviceState.binding];
        }
        if (
          where.callbackInstanceOid !== undefined &&
          serviceState.binding.callbackInstanceOid === where.callbackInstanceOid
        ) {
          return [serviceState.binding];
        }
        return [];
      })
    },
    provisionedVendorAppRoute: {
      findUnique: vi.fn(async ({ where }: any) =>
        serviceState.route?.id === where.id ? serviceState.route : null
      ),
      findUniqueOrThrow: vi.fn(async () => serviceState.route),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (
          !serviceState.route ||
          serviceState.route.oid !== where.oid ||
          serviceState.route.generation !== where.generation ||
          serviceState.route.deletedAt !== null
        ) {
          return { count: 0 };
        }
        Object.assign(serviceState.route, data);
        return { count: 1 };
      })
    },
    providerAuthCredentials: {
      findUnique: vi.fn(async ({ where }: any) =>
        serviceState.providerAuthCredential?.id === where.id
          ? serviceState.providerAuthCredential
          : null
      )
    },
    provisionedAppProjectionOutbox: {
      create: vi.fn(async ({ data }: any) => {
        serviceState.outboxCreateCount++;
        if (serviceState.failOutboxAt === serviceState.outboxCreateCount) {
          throw new Error('simulated outbox failure');
        }
        serviceState.outboxes.push(data);
        return data;
      })
    }
  };
  serviceState.tx = tx;
  return {
    db: tx,
    getId: (kind: string) => ({
      oid: BigInt(serviceState.nextId++),
      id: `${kind}-${serviceState.nextId}`
    }),
    withTransaction: async (run: (transaction: unknown) => unknown) => {
      let snapshot = structuredClone({
        binding: serviceState.binding,
        route: serviceState.route,
        outboxes: serviceState.outboxes,
        outboxCreateCount: serviceState.outboxCreateCount
      });
      try {
        return await run(tx);
      } catch (error) {
        serviceState.binding = snapshot.binding;
        serviceState.route = snapshot.route;
        serviceState.outboxes = snapshot.outboxes;
        serviceState.outboxCreateCount = snapshot.outboxCreateCount;
        throw error;
      }
    },
    addAfterTransactionHook: vi.fn()
  };
});

let {
  ProvisionedTenantAppError,
  assertGithubManifestState,
  assertProvisionedCredentialOwnerShape,
  assertResolvedProvisionedCredentialAuthority,
  assertSlackManagerAppProvisioningEnabled,
  buildProvisionedBindingProjection,
  buildProvisionedExternalOwnershipKey,
  buildProvisionedRouteProjection,
  canonicalProvisionedProjection,
  configureGithubManifestProvisioner,
  configureProvisionedByoCredentialSecretAuthorityResolver,
  digestProvisionedProjection,
  hashGithubManifestState,
  provisionedTenantAppService,
  resolveProvisionedCredentialOwner,
  tombstoneProvisionedTenantAppsForCallbackInTransaction
} = await import('./provisionedTenantApp');

let route = {
  id: 'route-1',
  routeIdentifier: 'public-selector-not-a-secret',
  vendor: 'github',
  purpose: 'shared_provisioned_app',
  credentialOwnerRef: 'managed-owner-1',
  generation: 3,
  routeSecretId: 'opaque-route-secret',
  routeSecretVersion: 2,
  vendorVerificationSecretId: 'opaque-vendor-secret',
  vendorVerificationVersion: 5,
  status: 'active',
  expiresAt: null,
  deletedAt: null
};

describe('provisioned tenant app authority', () => {
  beforeEach(() => {
    serviceState.failOutboxAt = null;
    serviceState.outboxCreateCount = 0;
    serviceState.outboxes = [];
  });
  it('keeps public route selectors, path secrets, and vendor credentials distinct', () => {
    let projection = buildProvisionedRouteProjection(route);
    expect(projection.routeIdentifier).toBe('public-selector-not-a-secret');
    expect(projection.routeSecretId).not.toBe(projection.routeIdentifier);
    expect(projection.vendorVerificationSecretId).not.toBe(projection.routeSecretId);
    expect(canonicalProvisionedProjection(projection)).not.toContain('plaintext');
  });

  it('enforces managed and BYO owner/nullability in the service boundary', () => {
    expect(() =>
      assertProvisionedCredentialOwnerShape({
        credentialOwnerType: 'managed',
        managedCredentialsOid: null
      })
    ).toThrowError(ProvisionedTenantAppError);
    expect(() =>
      assertProvisionedCredentialOwnerShape({
        credentialOwnerType: 'byo',
        managedCredentialsOid: 9n
      })
    ).toThrow('BYO provisioning cannot use a managed owner');
    expect(() =>
      assertProvisionedCredentialOwnerShape({
        credentialOwnerType: 'managed',
        managedCredentialsOid: 9n
      })
    ).not.toThrow();
    expect(() =>
      assertProvisionedCredentialOwnerShape({
        credentialOwnerType: 'byo',
        managedCredentialsOid: null
      })
    ).not.toThrow();
  });

  it('resolves managed and BYO owners through the exact tenant, vendor, and opaque secret', () => {
    let now = new Date('2026-08-15T12:00:00.000Z');
    let common = {
      tenantOid: 7n,
      vendor: 'github',
      credentialSecretId: 'secret-1',
      credentialSecretPurpose: 'vendor_verification',
      credentialVersion: 2,
      now
    };
    let managed = {
      ...common,
      credentialOwnerType: 'managed' as const,
      managedCredentialsOid: 9n,
      credentialOwnerRef: 'managed-owner-1',
      resolved: {
        ownerExists: true,
        ownerActive: true,
        ownerIsTenantOwned: false,
        ownerRef: 'managed-owner-1',
        ownerTenantOid: null,
        managedCredentialsOid: 9n,
        bindingTenantOid: 7n,
        vendor: 'GitHub',
        secretId: 'secret-1',
        secretPurpose: 'vendor_verification',
        secretVersion: 2,
        secretStatus: 'active',
        secretTenantOid: 7n,
        secretValidFrom: new Date('2026-08-15T11:00:00.000Z'),
        secretValidUntil: new Date('2026-08-15T13:00:00.000Z'),
        secretOwnerMatches: true
      }
    };
    expect(() => assertResolvedProvisionedCredentialAuthority(managed)).not.toThrow();
    for (let resolved of [
      { ...managed.resolved, bindingTenantOid: 8n },
      { ...managed.resolved, vendor: 'slack' },
      { ...managed.resolved, secretId: 'other-secret' },
      { ...managed.resolved, secretPurpose: 'callback_signing' },
      { ...managed.resolved, ownerRef: 'other-owner' }
    ]) {
      expect(() =>
        assertResolvedProvisionedCredentialAuthority({ ...managed, resolved })
      ).toThrow('Managed credential owner, tenant, vendor, or secret binding is invalid');
    }

    let byo = {
      ...common,
      credentialOwnerType: 'byo' as const,
      managedCredentialsOid: null,
      credentialOwnerRef: 'tenant-credential-1',
      resolved: {
        ...managed.resolved,
        ownerIsTenantOwned: true,
        ownerRef: 'tenant-credential-1',
        ownerTenantOid: 7n,
        managedCredentialsOid: null,
        bindingTenantOid: null
      }
    };
    expect(() => assertResolvedProvisionedCredentialAuthority(byo)).not.toThrow();
    for (let resolved of [
      { ...byo.resolved, ownerTenantOid: 8n },
      { ...byo.resolved, ownerIsTenantOwned: false },
      { ...byo.resolved, secretTenantOid: 8n },
      { ...byo.resolved, secretOwnerMatches: false }
    ]) {
      expect(() => assertResolvedProvisionedCredentialAuthority({ ...byo, resolved })).toThrow(
        'BYO credential owner, tenant, vendor, or secret binding is invalid'
      );
    }
  });

  it('uses separate production source models for managed and tenant-created credential secrets', async () => {
    let now = new Date('2026-08-15T12:00:00.000Z');
    let common = {
      tenantOid: 7n,
      vendor: 'github',
      credentialSecretId: 'secret-1',
      credentialSecretPurpose: 'vendor_verification',
      credentialVersion: 2,
      provisionedTenantAppId: 'binding-1',
      hubTenantId: 'hub-tenant-1',
      callbackInstanceId: 'callback-1',
      provisionedRouteId: 'route-1',
      routeGeneration: 3,
      hubReceiverId: 'receiver-1',
      hubReceiverGeneration: 4,
      hubReceiverTriggerId: 'trigger-1',
      triggerActionId: 'issues',
      triggerSpecHash: 'a'.repeat(64),
      now
    };
    let managedSecret = {
      id: 'secret-1',
      purpose: 'vendor_verification',
      secretVersion: 2,
      status: 'active',
      validFrom: new Date('2026-08-15T11:00:00.000Z'),
      validUntil: null,
      tenantOid: 7n,
      providerAuthCredentialsOid: 12n,
      managedCredentialsOid: 9n
    };
    let managedLookup = vi.fn().mockResolvedValue({
      oid: 9n,
      id: 'managed-owner-1',
      status: 'active',
      provider: { identifier: 'github' },
      initialProviderAuthMethod: { provider: { identifier: 'github' } },
      backings: [
        {
          tenantOid: 7n,
          providerAuthCredentialsOid: 12n,
          providerAuthCredentials: { id: 'backing-1' },
          secrets: [managedSecret]
        }
      ]
    });
    let tenantLookup = vi.fn();
    await expect(
      resolveProvisionedCredentialOwner({
        ...common,
        tx: {
          managedProviderAuthCredentials: { findUnique: managedLookup },
          providerAuthCredentials: { findUnique: tenantLookup }
        } as never,
        credentialOwnerType: 'managed',
        managedCredentialsOid: 9n,
        credentialOwnerRef: 'managed-owner-1'
      })
    ).resolves.toBeUndefined();
    expect(tenantLookup).not.toHaveBeenCalled();

    let byoResolver = {
      validate: vi.fn().mockResolvedValue({ valid: true }),
      createOrRotate: vi.fn(),
      revoke: vi.fn()
    };
    configureProvisionedByoCredentialSecretAuthorityResolver(byoResolver);
    let managedLookupForByo = vi.fn();
    await expect(
      resolveProvisionedCredentialOwner({
        ...common,
        tx: {
          managedProviderAuthCredentials: { findUnique: managedLookupForByo },
          providerAuthCredentials: {
            findUnique: vi.fn().mockResolvedValue({
              oid: 12n,
              id: 'tenant-owner-1',
              tenantOid: 7n,
              status: 'active',
              origin: 'tenant_created',
              provider: { identifier: 'github' }
            })
          }
        } as never,
        credentialOwnerType: 'byo',
        managedCredentialsOid: null,
        credentialOwnerRef: 'tenant-owner-1'
      })
    ).resolves.toBeUndefined();
    expect(managedLookupForByo).not.toHaveBeenCalled();
    expect(byoResolver.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialSecretId: 'secret-1',
        credentialSecretPurpose: 'vendor_verification',
        credentialVersion: 2
      })
    );
  });

  it('derives one tenant-independent ownership key for a provisioned installation', async () => {
    let first = buildProvisionedExternalOwnershipKey({
      vendor: 'GitHub',
      externalAppId: 'app-1',
      externalAccountId: 'account-1',
      externalInstallationId: 'installation-1',
      tenantId: 'tenant-1'
    } as never);
    let second = buildProvisionedExternalOwnershipKey({
      vendor: 'github',
      externalAppId: 'app-1',
      externalAccountId: 'account-1',
      externalInstallationId: 'installation-1',
      // A caller-selected tenant field is ignored by the immutable identity grammar.
      tenantId: 'tenant-2'
    } as never);
    expect(second).toBe(first);

    let claimed = new Set<string>();
    let activate = async (key: string) => {
      await Promise.resolve();
      if (claimed.has(key)) throw new Error('external ownership unique conflict');
      claimed.add(key);
      return key;
    };
    let race = await Promise.allSettled([activate(first), activate(second)]);
    expect(race.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(race.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('binds a projection to tenant, callback, exact Hub generation/action/spec, and owner', () => {
    let projection = buildProvisionedBindingProjection({
      id: 'binding-1',
      tenant: { slateTenantId: 'hub-tenant-1' },
      callbackInstance: { id: 'callback-instance-1' },
      vendorAppRoute: route,
      hubReceiverId: 'receiver-1',
      hubReceiverGeneration: 8,
      hubReceiverTriggerId: 'receiver-trigger-1',
      triggerActionId: 'issues',
      triggerSpecHash: 'a'.repeat(64),
      vendor: 'github',
      purpose: 'shared_provisioned_app',
      externalAppId: 'app-1',
      externalAccountId: 'account-1',
      externalInstallationId: 'installation-1',
      externalOwnershipKey: 'owner-key',
      retainedExternalOwnershipKey: null,
      ownerIdentity: 'org:metorial',
      credentialOwnerType: 'managed',
      credentialOwnerRef: 'managed-owner-1',
      credentialSecretId: 'opaque-vendor-secret',
      credentialSecretPurpose: 'vendor_verification',
      credentialVersion: 5,
      generation: 4,
      status: 'active',
      expiresAt: null,
      deletedAt: null
    });
    expect(projection).toMatchObject({
      hubTenantId: 'hub-tenant-1',
      callbackInstanceId: 'callback-instance-1',
      hubReceiverId: 'receiver-1',
      hubReceiverGeneration: 8,
      hubReceiverTriggerId: 'receiver-trigger-1',
      triggerActionId: 'issues',
      triggerSpecHash: 'a'.repeat(64)
    });
    expect(digestProvisionedProjection(projection)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('uses expiring, constant-time GitHub manifest state and keeps installation separate', () => {
    let state = 'csrf-state';
    let hash = hashGithubManifestState(state);
    expect(() =>
      assertGithubManifestState({
        presentedState: state,
        storedStateHash: hash,
        expiresAt: new Date('2026-08-15T12:10:00.000Z'),
        now: new Date('2026-08-15T12:00:00.000Z')
      })
    ).not.toThrow();
    expect(() =>
      assertGithubManifestState({
        presentedState: 'wrong-state',
        storedStateHash: hash,
        expiresAt: new Date('2026-08-15T12:10:00.000Z'),
        now: new Date('2026-08-15T12:00:00.000Z')
      })
    ).toThrow('invalid or expired');
    expect(() =>
      assertGithubManifestState({
        presentedState: state,
        storedStateHash: hash,
        expiresAt: new Date('2026-08-15T12:00:00.000Z'),
        now: new Date('2026-08-15T12:00:00.000Z')
      })
    ).toThrow('invalid or expired');
  });

  it('runs GitHub manifest exchange and installation as separate persisted transitions', async () => {
    serviceState.binding = {
      oid: 1n,
      id: 'binding-github',
      tenantOid: 7n,
      callbackInstanceOid: 8n,
      vendorAppRouteOid: 9n,
      hubReceiverId: 'receiver-1',
      hubReceiverGeneration: 1,
      hubReceiverTriggerId: 'trigger-1',
      triggerActionId: 'issues',
      triggerSpecHash: 'a'.repeat(64),
      vendor: 'github',
      purpose: 'shared_provisioned_app',
      externalAppId: null,
      externalAccountId: null,
      externalInstallationId: null,
      externalOwnershipKey: null,
      retainedExternalOwnershipKey: null,
      ownerIdentity: null,
      credentialOwnerType: 'byo',
      managedCredentialsOid: null,
      credentialOwnerRef: 'tenant-credential-1',
      credentialSecretId: 'secret-1',
      credentialSecretPurpose: 'vendor_verification',
      credentialVersion: 1,
      generation: 1,
      status: 'pending',
      projectionDigest: 'pending',
      correlationId: null,
      expiresAt: null,
      githubManifestStateHash: null,
      githubManifestStateExpiresAt: null,
      githubManifestCompletedAt: null,
      githubInstallationCompletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      tenant: { slateTenantId: 'hub-tenant-1' },
      callbackInstance: { id: 'callback-1' },
      vendorAppRoute: route
    };
    configureGithubManifestProvisioner({
      getManifestRedirectUrl: ({ state }) =>
        `https://github.com/settings/apps/new?state=${encodeURIComponent(state)}`,
      exchangeManifestCode: vi.fn(async () => ({
        externalAppId: 'github-app-1',
        ownerIdentity: 'organization:metorial'
      })),
      resolveInstallation: vi.fn(async () => ({
        externalAppId: 'different-github-app',
        externalInstallationId: 'installation-1',
        ownerIdentity: 'organization:metorial'
      }))
    });

    let begun = await provisionedTenantAppService.beginGithubManifest({
      provisionedTenantAppId: 'binding-github',
      expectedGeneration: 1
    });
    expect(begun).toMatchObject({
      state: expect.any(String),
      redirectUrl: expect.stringContaining('https://github.com/settings/apps/new?state='),
      generation: 2
    });
    expect(serviceState.binding).toMatchObject({ status: 'manifest_pending' });

    let exchanged = await provisionedTenantAppService.completeGithubManifest({
      provisionedTenantAppId: 'binding-github',
      expectedGeneration: 2,
      state: begun.state,
      code: 'single-use-manifest-code'
    });
    expect(exchanged.binding).toMatchObject({
      generation: 3,
      status: 'installation_pending',
      externalAppId: 'github-app-1',
      githubInstallationCompletedAt: null
    });
    expect(serviceState.binding.githubManifestStateHash).toBeNull();

    await expect(
      provisionedTenantAppService.completeGithubInstallation({
        provisionedTenantAppId: 'binding-github',
        expectedGeneration: 3,
        installationCode: 'installation-code'
      })
    ).rejects.toMatchObject({ code: 'github_installation_app_mismatch' });
    expect(serviceState.binding.status).toBe('installation_pending');

    serviceState.providerAuthCredential = {
      oid: 12n,
      id: 'tenant-credential-1',
      tenantOid: 7n,
      status: 'active',
      origin: 'tenant_created',
      provider: { identifier: 'github' }
    };
    configureProvisionedByoCredentialSecretAuthorityResolver({
      validate: vi.fn().mockResolvedValue({ valid: true }),
      createOrRotate: vi.fn(),
      revoke: vi.fn()
    });
    configureGithubManifestProvisioner({
      getManifestRedirectUrl: ({ state }) =>
        `https://github.com/settings/apps/new?state=${encodeURIComponent(state)}`,
      exchangeManifestCode: vi.fn(),
      resolveInstallation: vi.fn(async () => ({
        externalAppId: 'github-app-1',
        externalInstallationId: 'installation-1',
        externalAccountId: 'account-1',
        ownerIdentity: 'organization:metorial'
      }))
    });
    await expect(
      provisionedTenantAppService.completeGithubInstallation({
        provisionedTenantAppId: 'binding-github',
        expectedGeneration: 3,
        installationCode: 'installation-code'
      })
    ).resolves.toMatchObject({
      binding: {
        generation: 4,
        status: 'active',
        externalAppId: 'github-app-1',
        externalInstallationId: 'installation-1',
        githubInstallationCompletedAt: expect.any(Date)
      }
    });
  });

  it('keeps Slack manager-app provisioning disabled without an explicit capability flag', () => {
    expect(() => assertSlackManagerAppProvisioningEnabled()).toThrow(
      'Slack manager-app provisioning is disabled; use BYO app provisioning'
    );
  });

  it('cascades route rotation to every dependent binding and rolls the transaction back on outbox failure', async () => {
    let now = new Date('2026-08-15T00:00:00.000Z');
    serviceState.route = {
      oid: 9n,
      ...route,
      generation: 3,
      projectionDigest: 'route-digest',
      createdAt: now,
      updatedAt: now
    };
    serviceState.binding = {
      oid: 1n,
      id: 'binding-route-cascade',
      tenantOid: 7n,
      callbackInstanceOid: 8n,
      vendorAppRouteOid: 9n,
      hubReceiverId: 'receiver-1',
      hubReceiverGeneration: 1,
      hubReceiverTriggerId: 'trigger-1',
      triggerActionId: 'issues',
      triggerSpecHash: 'a'.repeat(64),
      vendor: 'github',
      purpose: 'shared_provisioned_app',
      externalAppId: null,
      externalAccountId: null,
      externalInstallationId: null,
      externalOwnershipKey: null,
      retainedExternalOwnershipKey: null,
      ownerIdentity: null,
      credentialOwnerType: 'managed',
      managedCredentialsOid: 10n,
      credentialOwnerRef: 'managed-owner-1',
      credentialSecretId: 'opaque-vendor-secret',
      credentialSecretPurpose: 'vendor_verification',
      credentialVersion: 5,
      generation: 4,
      status: 'pending',
      projectionDigest: 'binding-digest',
      correlationId: null,
      expiresAt: null,
      githubManifestStateHash: null,
      githubManifestStateExpiresAt: null,
      githubManifestCompletedAt: null,
      githubInstallationCompletedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      tenant: { slateTenantId: 'hub-tenant-1' },
      callbackInstance: { id: 'callback-1' },
      vendorAppRoute: serviceState.route
    };

    let result = await provisionedTenantAppService.activateProvisionedVendorAppRoute({
      provisionedRouteId: route.id,
      expectedGeneration: 3,
      routeSecretId: 'path-secret-4',
      routeSecretVersion: 4,
      vendorVerificationSecretId: 'vendor-secret-6',
      vendorVerificationVersion: 6
    });
    expect(result.bindingOutboxIds).toHaveLength(1);
    expect(serviceState.route.generation).toBe(4);
    expect(serviceState.binding.generation).toBe(5);
    expect(serviceState.binding.status).toBe('tombstoned');
    expect(serviceState.binding.deletedAt).toBeInstanceOf(Date);
    expect(serviceState.outboxes.map(row => row.payload.routeGeneration)).toContain(4);

    serviceState.binding = {
      ...serviceState.binding,
      credentialOwnerType: 'byo',
      managedCredentialsOid: null,
      id: 'binding-route-cascade-byo',
      generation: 5,
      status: 'active',
      externalOwnershipKey: 'owner-key-byo',
      retainedExternalOwnershipKey: null,
      deletedAt: null,
      vendorAppRoute: serviceState.route
    };
    let before = structuredClone({ route: serviceState.route, binding: serviceState.binding });
    serviceState.outboxCreateCount = 0;
    serviceState.failOutboxAt = 2;
    await expect(
      provisionedTenantAppService.activateProvisionedVendorAppRoute({
        provisionedRouteId: route.id,
        expectedGeneration: 4,
        routeSecretId: 'path-secret-5',
        routeSecretVersion: 5,
        vendorVerificationSecretId: 'vendor-secret-7',
        vendorVerificationVersion: 7
      })
    ).rejects.toThrow('simulated outbox failure');
    expect(serviceState.route).toEqual(before.route);
    expect(serviceState.binding).toEqual(before.binding);

    serviceState.failOutboxAt = null;
    serviceState.outboxCreateCount = 0;
    await provisionedTenantAppService.activateProvisionedVendorAppRoute({
      provisionedRouteId: route.id,
      expectedGeneration: 4,
      routeSecretId: 'path-secret-5',
      routeSecretVersion: 5,
      vendorVerificationSecretId: 'vendor-secret-7',
      vendorVerificationVersion: 7
    });
    expect(serviceState.route.generation).toBe(5);
    expect(serviceState.binding).toMatchObject({ generation: 6, status: 'active' });
    expect(serviceState.outboxes.map(row => row.payload.routeGeneration)).toContain(5);
  });

  it('tombstones callback dependents with an outbox exactly once', async () => {
    let now = new Date('2026-08-15T00:00:00.000Z');
    serviceState.route = {
      oid: 9n,
      ...route,
      projectionDigest: 'route-digest',
      createdAt: now,
      updatedAt: now
    };
    serviceState.binding = {
      oid: 1n,
      id: 'binding-detach',
      tenantOid: 7n,
      callbackInstanceOid: 8n,
      vendorAppRouteOid: 9n,
      hubReceiverId: 'receiver-1',
      hubReceiverGeneration: 1,
      hubReceiverTriggerId: 'trigger-1',
      triggerActionId: 'issues',
      triggerSpecHash: 'a'.repeat(64),
      vendor: 'github',
      purpose: 'shared_provisioned_app',
      externalAppId: 'app-1',
      externalAccountId: null,
      externalInstallationId: 'install-1',
      externalOwnershipKey: 'owner-key',
      retainedExternalOwnershipKey: null,
      ownerIdentity: 'org:metorial',
      credentialOwnerType: 'managed',
      managedCredentialsOid: 10n,
      credentialOwnerRef: 'managed-owner-1',
      credentialSecretId: 'opaque-vendor-secret',
      credentialSecretPurpose: 'vendor_verification',
      credentialVersion: 5,
      generation: 4,
      status: 'active',
      projectionDigest: 'binding-digest',
      correlationId: null,
      expiresAt: null,
      githubManifestStateHash: null,
      githubManifestStateExpiresAt: null,
      githubManifestCompletedAt: null,
      githubInstallationCompletedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      tenant: { slateTenantId: 'hub-tenant-1' },
      callbackInstance: { id: 'callback-1' },
      vendorAppRoute: serviceState.route
    };
    await expect(
      tombstoneProvisionedTenantAppsForCallbackInTransaction(serviceState.tx, 8n, now)
    ).resolves.toHaveLength(1);
    expect(serviceState.binding).toMatchObject({
      generation: 5,
      status: 'tombstoned',
      externalOwnershipKey: null,
      retainedExternalOwnershipKey: 'owner-key',
      deletedAt: now
    });
    expect(serviceState.outboxes).toHaveLength(1);
    expect(serviceState.outboxes[0].payload).toMatchObject({
      routeGeneration: 3,
      tombstone: true
    });
    await expect(
      tombstoneProvisionedTenantAppsForCallbackInTransaction(serviceState.tx, 8n, now)
    ).resolves.toEqual([]);
    expect(serviceState.outboxes).toHaveLength(1);
  });

});
