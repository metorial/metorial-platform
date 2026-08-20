import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeWebhookActionSpecHashV1 } from '@slates/proto';

let state = vi.hoisted(() => ({
  routes: [] as any[],
  bindings: [] as any[],
  routeSecrets: [] as any[],
  receiver: null as any,
  secondReceiver: null as any,
  triggerSecret: null as any,
  configuredAuthorityResolver: null as any
}));

let routeProjectionDelegate = {
  findUnique: vi.fn(
    async ({ where }: any) =>
      state.routes.find(route =>
        where.provisionedRouteId
          ? route.provisionedRouteId === where.provisionedRouteId
          : route.routeIdentifier === where.routeIdentifier
      ) ?? null
  ),
  findFirst: vi.fn(
    async ({ where }: any) =>
      state.routes.find(
        route =>
          route.routeIdentifier === where.routeIdentifier &&
          route.status === where.status &&
          route.tombstonedAt === null
      ) ?? null
  ),
  create: vi.fn(async ({ data }: any) => {
    let row = { ...data };
    state.routes.push(row);
    return row;
  }),
  update: vi.fn(async ({ where, data }: any) => {
    let row = state.routes.find(route => route.oid === where.oid);
    Object.assign(row, data);
    return row;
  })
};

let bindingProjectionDelegate = {
  findUnique: vi.fn(
    async ({ where }: any) =>
      state.bindings.find(binding =>
        where.provisionedTenantAppId
          ? binding.provisionedTenantAppId === where.provisionedTenantAppId
          : binding.id === where.id
      ) ?? null
  ),
  findFirst: vi.fn(async ({ where }: any) => {
    if (where.routeProjection?.id) {
      return (
        state.bindings.find(
          binding =>
            binding.routeProjectionId === where.routeProjection.id &&
            binding.externalOwnershipKey === where.externalOwnershipKey &&
            binding.status === 'active' &&
            binding.tombstonedAt === null
        ) ?? null
      );
    }
    return (
      state.bindings
        .filter(
          binding =>
            binding.routeProjectionOid === where.routeProjectionOid &&
            where.OR.some((condition: any) =>
              condition.externalOwnershipKey
                ? binding.externalOwnershipKey === condition.externalOwnershipKey
                : binding.retainedExternalOwnershipKey ===
                  condition.retainedExternalOwnershipKey
            )
        )
        .sort((left, right) => right.generation - left.generation)[0] ?? null
    );
  }),
  count: vi.fn(
    async ({ where }: any) =>
      state.bindings.filter(
        binding =>
          binding.routeProjectionOid === where.routeProjectionOid &&
          binding.tombstonedAt === null
      ).length
  ),
  create: vi.fn(async ({ data }: any) => {
    let row = {
      ...data,
      routeProjectionId: state.routes.find(route => route.oid === data.routeProjectionOid)?.id
    };
    state.bindings.push(row);
    return row;
  }),
  update: vi.fn(async ({ where, data }: any) => {
    let row = state.bindings.find(binding => binding.oid === where.oid);
    Object.assign(row, data);
    return row;
  })
};

let routeSecretFindMany = vi.fn(async ({ where }: any) =>
  state.routeSecrets.filter(
    secret =>
      secret.provisionedRouteId === where.provisionedRouteId &&
      secret.routeGeneration === where.routeGeneration &&
      where.id.in.includes(secret.id)
  )
);

vi.mock('../db', () => {
  let db: any = {
    slateProvisionedAppRouteSecret: {
      findMany: routeSecretFindMany
    },
    slateProvisionedAppRouteProjection: routeProjectionDelegate,
    slateProvisionedTenantAppProjection: bindingProjectionDelegate,
    slateTriggerReceiver: {
      findFirst: vi.fn(async ({ where }: any) => {
        for (let receiver of [state.receiver, state.secondReceiver]) {
          if (receiver?.id === where.id && receiver.tenant.id === where.tenant.id) {
            return receiver;
          }
        }
        return null;
      })
    },
    slateTriggerReceiverSecret: {
      findFirst: vi.fn(async ({ where }: any) => {
        let secret = state.triggerSecret;
        if (!secret) return null;
        for (let key of [
          'id',
          'secretVersion',
          'tenantOid',
          'receiverOid',
          'receiverTriggerOid',
          'specHash',
          'sourceBindingType',
          'sourceBindingId',
          'name',
          'status'
        ]) {
          if (where[key] !== undefined && secret[key] !== where[key]) return null;
        }
        if (where.validFrom?.lte && secret.validFrom > where.validFrom.lte) return null;
        if (
          secret.validUntil !== null &&
          where.OR?.some((entry: any) => entry.validUntil?.gt) &&
          secret.validUntil <=
            where.OR.find((entry: any) => entry.validUntil?.gt).validUntil.gt
        ) {
          return null;
        }
        return secret;
      })
    }
  };
  db.$transaction = vi.fn(async (run: (tx: any) => unknown) => await run(db));
  return { db };
});
vi.mock('../id', () => {
  let next = 1n;
  return {
    getId: (kind: string) => ({ oid: next++, id: `${kind}-${String(next)}` })
  };
});
vi.mock('./slateTriggerProvisionedRouteAuthority', () => ({
  configureSlateProvisionedRouteAuthorityResolver: (resolver: unknown) => {
    state.configuredAuthorityResolver = resolver;
  }
}));

let {
  SlateProvisionedProjectionError,
  buildSlateProvisionedExternalOwnershipKey,
  digestSlateProvisionedProjection,
  projectSlateProvisionedAppRoute,
  projectSlateProvisionedTenantApp,
  resolveActiveSlateProvisionedAppRoute,
  resolveSelectedSlateProvisionedAppRouteForRouting,
  resolveActiveSlateProvisionedTenantApp,
  validateProvisionedTenantCredentialSecret
} = await import('./slateTriggerReceiverSecretProjection');

let routeProjection = (overrides: Record<string, unknown> = {}) => ({
  version: 1 as const,
  entityKind: 'route' as const,
  provisionedRouteId: 'route-1',
  routeIdentifier: 'selector-1',
  vendor: 'slack',
  purpose: 'shared_provisioned_app',
  credentialOwnerRef: 'owner-1',
  generation: 1,
  routeSecretId: 'path-secret-1',
  routeSecretVersion: 1,
  vendorVerificationSecretId: 'vendor-secret-1',
  vendorVerificationVersion: 1,
  status: 'active',
  tombstone: false,
  tombstoneRetainUntil: null,
  expiresAt: null,
  ...overrides
});

let envelope = <T extends { entityKind: string; generation: number }>(
  projection: T,
  entityId: string
) => {
  let projectionDigest = digestSlateProvisionedProjection(projection);
  return {
    projection,
    projectionDigest,
    correlationId: `correlation-${projection.generation}`,
    idempotencyKey: `provisioned-projection/v1:${projection.entityKind}:${entityId}:${projection.generation}:${projectionDigest}`
  };
};

let sharedActionContract = () => {
  let action: any = {
    id: 'events',
    type: 'action.trigger',
    capabilities: {},
    invocation: {
      type: 'webhook',
      autoRegistration: true,
      autoUnregistration: true,
      http: {
        methods: ['POST'],
        ingress: {
          kind: 'shared_provisioned_app',
          baseline: 'app_route_secret',
          routeFamily: 'slack',
          verification: {
            mechanism: 'hub',
            allowedSecretRefs: [],
            rules: [
              {
                id: 'bootstrap.v1',
                phase: 'bootstrap',
                when: { methods: ['POST'] },
                verify: { type: 'preset', preset: 'slack.v0' },
                result: { type: 'sync_only' },
                replay: { kind: 'not_applicable', reason: 'bootstrap_sync_only' }
              }
            ]
          }
        }
      }
    }
  };
  action.specHash = computeWebhookActionSpecHashV1(action);
  return action;
};

let bindingProjection = (overrides: Record<string, unknown> = {}) => {
  let ownership = {
    vendor: 'slack',
    externalAppId: 'app-1',
    externalAccountId: 'team-1',
    externalInstallationId: 'installation-1'
  };
  return {
    version: 1 as const,
    entityKind: 'binding' as const,
    provisionedTenantAppId: 'binding-1',
    provisionedRouteId: 'route-1',
    routeIdentifier: 'selector-1',
    routeGeneration: 1,
    hubTenantId: 'tenant-1',
    callbackInstanceId: 'callback-1',
    hubReceiverId: 'receiver-1',
    hubReceiverGeneration: 4,
    hubReceiverTriggerId: 'trigger-1',
    triggerActionId: 'events',
    triggerSpecHash: state.receiver.triggers[0].action.spec.specHash,
    ...ownership,
    purpose: 'shared_provisioned_app',
    externalOwnershipKey: buildSlateProvisionedExternalOwnershipKey(ownership),
    ownerIdentity: 'team:team-1',
    credentialOwnerType: 'managed' as const,
    credentialOwnerRef: 'owner-1',
    credentialSecretId: 'vendor-secret-1',
    credentialSecretPurpose: 'vendor_verification' as const,
    credentialVersion: 1,
    generation: 1,
    status: 'active',
    tombstone: false,
    tombstoneRetainUntil: null,
    expiresAt: null,
    ...overrides
  };
};

describe('Hub provisioned-app projection boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.routes.length = 0;
    state.bindings.length = 0;
    state.triggerSecret = null;
    state.routeSecrets = [
      {
        id: 'path-secret-1',
        provisionedRouteId: 'route-1',
        routeGeneration: 1,
        vendor: 'slack',
        credentialOwnerRef: 'owner-1',
        purpose: 'app_route_path',
        secretVersion: 1,
        status: 'active',
        validFrom: new Date('2026-08-15T00:00:00.000Z'),
        validUntil: null
      },
      {
        id: 'vendor-secret-1',
        provisionedRouteId: 'route-1',
        routeGeneration: 1,
        vendor: 'slack',
        credentialOwnerRef: 'owner-1',
        purpose: 'vendor_verification',
        secretVersion: 1,
        status: 'active',
        validFrom: new Date('2026-08-15T00:00:00.000Z'),
        validUntil: null
      }
    ];
    let spec = sharedActionContract();
    state.receiver = {
      oid: 10n,
      id: 'receiver-1',
      tenantOid: 20n,
      tenant: { id: 'tenant-1' },
      callbackInstanceId: 'callback-1',
      status: 'active',
      tombstonedAt: null,
      triggers: [
        {
          oid: 30n,
          id: 'trigger-1',
          registrationGeneration: 4,
          verificationMechanism: 'hub',
          verificationSpecHash: spec.specHash,
          source: 'webhook',
          tombstonedAt: null,
          ingressDisabledAt: null,
          action: { key: 'events', spec }
        }
      ]
    };
    state.secondReceiver = {
      ...state.receiver,
      oid: 11n,
      id: 'receiver-2',
      callbackInstanceId: 'callback-2',
      triggers: [
        {
          ...state.receiver.triggers[0],
          oid: 31n,
          id: 'trigger-2'
        }
      ]
    };
  });

  it('accepts generation 1, idempotently retries it, and rejects conflicts/gaps', async () => {
    let first = routeProjection();
    await expect(
      projectSlateProvisionedAppRoute(
        envelope(first, first.provisionedRouteId),
        new Date('2026-08-15T01:00:00.000Z')
      )
    ).resolves.toMatchObject({ generation: 1, idempotent: false });
    await expect(
      projectSlateProvisionedAppRoute(
        envelope(first, first.provisionedRouteId),
        new Date('2026-08-15T01:00:00.000Z')
      )
    ).resolves.toMatchObject({ generation: 1, idempotent: true });

    let conflict = routeProjection({ status: 'pending' });
    await expect(
      projectSlateProvisionedAppRoute(envelope(conflict, conflict.provisionedRouteId))
    ).rejects.toMatchObject({ code: 'projection_digest_conflict' });
    let gap = routeProjection({ generation: 3 });
    await expect(
      projectSlateProvisionedAppRoute(envelope(gap, gap.provisionedRouteId))
    ).rejects.toMatchObject({ code: 'projection_generation_rejected' });
  });

  it('stages route authority before secret creation but keeps routing unavailable', async () => {
    state.routeSecrets = [];
    let route = routeProjection();
    await expect(
      projectSlateProvisionedAppRoute(envelope(route, route.provisionedRouteId))
    ).resolves.toMatchObject({ generation: 1 });
    await expect(
      state.configuredAuthorityResolver.resolve({
        provisionedRouteId: route.provisionedRouteId,
        purpose: 'app_route_path'
      })
    ).resolves.toMatchObject({
      secretId: route.routeSecretId,
      secretVersion: route.routeSecretVersion,
      status: 'active'
    });
    await expect(
      resolveActiveSlateProvisionedAppRoute({ routeIdentifier: route.routeIdentifier })
    ).rejects.toMatchObject({ code: 'route_secret_binding_mismatch' });
  });

  it('reads only the selected route projection before shared-app credential checks', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(envelope(route, route.provisionedRouteId));
    vi.clearAllMocks();

    await expect(
      resolveSelectedSlateProvisionedAppRouteForRouting({
        routeIdentifier: route.routeIdentifier,
        now: new Date('2026-08-15T01:00:00.000Z')
      })
    ).resolves.toMatchObject({
      provisionedRouteId: route.provisionedRouteId,
      routeIdentifier: route.routeIdentifier
    });
    expect(routeProjectionDelegate.findUnique).toHaveBeenCalledTimes(1);
    expect(routeSecretFindMany).not.toHaveBeenCalled();
    expect(bindingProjectionDelegate.findFirst).not.toHaveBeenCalled();
  });

  it('rejects route purpose, secret generation, owner, and version mismatches', async () => {
    for (let projection of [
      routeProjection({ purpose: 'receiver_route' }),
      routeProjection({ routeSecretVersion: 9 }),
      routeProjection({ credentialOwnerRef: 'wrong-owner' }),
      routeProjection({ routeSecretId: 'vendor-secret-1' })
    ]) {
      await expect(
        projectSlateProvisionedAppRoute(envelope(projection, projection.provisionedRouteId))
      ).rejects.toBeInstanceOf(SlateProvisionedProjectionError);
    }
  });

  it('denies active route resolution when either exact route secret is unusable', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(
      envelope(route, route.provisionedRouteId),
      new Date('2026-08-15T01:00:00.000Z')
    );
    await expect(
      resolveActiveSlateProvisionedAppRoute({
        routeIdentifier: route.routeIdentifier,
        now: new Date('2026-08-15T01:00:00.000Z')
      })
    ).resolves.toMatchObject({ provisionedRouteId: route.provisionedRouteId });

    state.routeSecrets[0].status = 'revoked';
    await expect(
      resolveActiveSlateProvisionedAppRoute({
        routeIdentifier: route.routeIdentifier,
        now: new Date('2026-08-15T01:00:00.000Z')
      })
    ).rejects.toMatchObject({ code: 'route_secret_unavailable' });
  });

  it('requires tombstone plus a new ID for stable route and binding authority changes', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(envelope(route, route.provisionedRouteId));
    let rewrittenRoute = routeProjection({ generation: 2, vendor: 'github' });
    await expect(
      projectSlateProvisionedAppRoute(
        envelope(rewrittenRoute, rewrittenRoute.provisionedRouteId)
      )
    ).rejects.toMatchObject({ code: 'route_authority_immutable' });

    let binding = bindingProjection();
    await projectSlateProvisionedTenantApp(envelope(binding, binding.provisionedTenantAppId));
    let rewrittenBinding = bindingProjection({
      generation: 2,
      credentialOwnerType: 'byo',
      credentialOwnerRef: 'tenant-owner-2',
      credentialSecretId: 'tenant-secret-2',
      credentialVersion: 2
    });
    state.triggerSecret = {
      id: 'tenant-secret-2',
      secretVersion: 2,
      tenantOid: state.receiver.tenantOid,
      receiverOid: state.receiver.oid,
      receiverTriggerOid: state.receiver.triggers[0].oid,
      specHash: rewrittenBinding.triggerSpecHash,
      sourceBindingType: 'provisioned_app',
      sourceBindingId: binding.provisionedTenantAppId,
      name: 'vendor_verification',
      status: 'active',
      validFrom: new Date('2026-08-15T00:00:00.000Z'),
      validUntil: null
    };
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(rewrittenBinding, rewrittenBinding.provisionedTenantAppId)
      )
    ).rejects.toMatchObject({ code: 'binding_authority_immutable' });
  });

  it('rejects same-ID receiver generation/action/spec rewrites even when they became current', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(envelope(route, route.provisionedRouteId));
    let binding = bindingProjection();
    await projectSlateProvisionedTenantApp(envelope(binding, binding.provisionedTenantAppId));

    let nextSpec = sharedActionContract();
    nextSpec.id = 'events-v2';
    nextSpec.specHash = computeWebhookActionSpecHashV1(nextSpec);
    state.receiver.triggers[0].registrationGeneration = 5;
    state.receiver.triggers[0].action = { key: 'events-v2', spec: nextSpec };
    state.receiver.triggers[0].verificationSpecHash = nextSpec.specHash;

    let rewritten = bindingProjection({
      generation: 2,
      hubReceiverGeneration: 5,
      triggerActionId: 'events-v2',
      triggerSpecHash: nextSpec.specHash
    });
    await expect(
      projectSlateProvisionedTenantApp(envelope(rewritten, rewritten.provisionedTenantAppId))
    ).rejects.toMatchObject({ code: 'binding_authority_immutable' });
    expect(state.bindings[0]).toMatchObject({
      hubReceiverGeneration: 4,
      triggerActionId: 'events',
      triggerSpecHash: binding.triggerSpecHash,
      generation: 1
    });
  });

  it('stages null ownership exactly once, freezes active ownership, and requires a new ID after tombstone', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(envelope(route, route.provisionedRouteId));
    let pending = bindingProjection({
      externalAppId: null,
      externalAccountId: null,
      externalInstallationId: null,
      externalOwnershipKey: null,
      ownerIdentity: null,
      status: 'pending'
    });
    await expect(
      projectSlateProvisionedTenantApp(envelope(pending, pending.provisionedTenantAppId))
    ).resolves.toMatchObject({ generation: 1 });

    let manifestPending = { ...pending, generation: 2, status: 'manifest_pending' };
    await projectSlateProvisionedTenantApp(
      envelope(manifestPending, manifestPending.provisionedTenantAppId)
    );
    let installationPending = bindingProjection({
      generation: 3,
      status: 'installation_pending',
      externalAccountId: null,
      externalInstallationId: null,
      externalOwnershipKey: null
    });
    await projectSlateProvisionedTenantApp(
      envelope(installationPending, installationPending.provisionedTenantAppId)
    );
    let active = bindingProjection({ generation: 4 });
    await expect(
      projectSlateProvisionedTenantApp(envelope(active, active.provisionedTenantAppId))
    ).resolves.toMatchObject({ generation: 4 });

    let rewrittenOwnership = {
      vendor: active.vendor,
      externalAppId: 'app-attacker',
      externalAccountId: active.externalAccountId,
      externalInstallationId: active.externalInstallationId
    };
    let activeRewrite = bindingProjection({
      generation: 5,
      externalAppId: rewrittenOwnership.externalAppId,
      externalOwnershipKey: buildSlateProvisionedExternalOwnershipKey(rewrittenOwnership)
    });
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(activeRewrite, activeRewrite.provisionedTenantAppId)
      )
    ).rejects.toMatchObject({ code: 'binding_authority_immutable' });

    let retainUntil = new Date('2026-09-15T00:00:00.000Z').toISOString();
    let tombstone = bindingProjection({
      generation: 5,
      status: 'tombstoned',
      tombstone: true,
      tombstoneRetainUntil: retainUntil
    });
    await projectSlateProvisionedTenantApp(
      envelope(tombstone, tombstone.provisionedTenantAppId)
    );
    state.receiver.triggers[0].registrationGeneration = 5;
    let replacement = bindingProjection({
      provisionedTenantAppId: 'binding-replacement',
      generation: 6,
      hubReceiverGeneration: 5
    });
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(replacement, replacement.provisionedTenantAppId)
      )
    ).resolves.toMatchObject({ generation: 6 });

    let staleOldId = bindingProjection({ generation: 6, hubReceiverGeneration: 5 });
    await expect(
      projectSlateProvisionedTenantApp(envelope(staleOldId, staleOldId.provisionedTenantAppId))
    ).rejects.toMatchObject({ code: 'binding_reprovision_required' });
  });

  it('re-resolves tenant/callback/receiver generation/action/spec and app ownership', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(
      envelope(route, route.provisionedRouteId),
      new Date('2026-08-15T01:00:00.000Z')
    );
    let binding = bindingProjection();
    await expect(
      projectSlateProvisionedTenantApp(envelope(binding, binding.provisionedTenantAppId))
    ).resolves.toMatchObject({ generation: 1 });
    await expect(
      projectSlateProvisionedTenantApp(envelope(binding, binding.provisionedTenantAppId))
    ).resolves.toMatchObject({ generation: 1, idempotent: true });

    let digestConflict = bindingProjection({ status: 'pending' });
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(digestConflict, digestConflict.provisionedTenantAppId)
      )
    ).rejects.toMatchObject({ code: 'projection_digest_conflict' });
    let gap = bindingProjection({ generation: 3 });
    await expect(
      projectSlateProvisionedTenantApp(envelope(gap, gap.provisionedTenantAppId))
    ).rejects.toMatchObject({ code: 'projection_generation_rejected' });

    for (let overrides of [
      { routeGeneration: 2 },
      { hubTenantId: 'tenant-selected-by-payload' },
      { callbackInstanceId: 'other-callback' },
      { hubReceiverId: 'other-receiver' },
      { hubReceiverGeneration: 5 },
      { triggerActionId: 'other-action' },
      { triggerSpecHash: 'f'.repeat(64) },
      { externalOwnershipKey: 'attacker-selected-key' }
    ]) {
      let candidate = bindingProjection({
        ...overrides,
        provisionedTenantAppId: `candidate-${Object.keys(overrides)[0]}`
      });
      await expect(
        projectSlateProvisionedTenantApp(envelope(candidate, candidate.provisionedTenantAppId))
      ).rejects.toBeInstanceOf(SlateProvisionedProjectionError);
    }
  });

  it('does not let a second receiver in the same tenant share or overwrite a live app binding', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(
      envelope(route, route.provisionedRouteId),
      new Date('2026-08-15T01:00:00.000Z')
    );
    let first = bindingProjection();
    await projectSlateProvisionedTenantApp(envelope(first, first.provisionedTenantAppId));

    let second = bindingProjection({
      provisionedTenantAppId: 'binding-2',
      callbackInstanceId: 'callback-2',
      hubReceiverId: 'receiver-2',
      hubReceiverTriggerId: 'trigger-2'
    });
    await expect(
      projectSlateProvisionedTenantApp(envelope(second, second.provisionedTenantAppId))
    ).rejects.toMatchObject({ code: 'external_ownership_conflict' });
    expect(state.bindings).toHaveLength(1);
    expect(state.bindings[0]).toMatchObject({ receiverOid: 10n });
  });

  it('tombstones before rebind, retains rollback evidence, and requires incremented receiver authority', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(
      envelope(route, route.provisionedRouteId),
      new Date('2026-08-15T01:00:00.000Z')
    );
    let active = bindingProjection();
    await projectSlateProvisionedTenantApp(envelope(active, active.provisionedTenantAppId));
    let retainUntil = new Date('2026-09-15T00:00:00.000Z').toISOString();
    let tombstone = bindingProjection({
      generation: 2,
      status: 'tombstoned',
      tombstone: true,
      tombstoneRetainUntil: retainUntil
    });
    await projectSlateProvisionedTenantApp(
      envelope(tombstone, tombstone.provisionedTenantAppId),
      new Date('2026-08-15T02:00:00.000Z')
    );
    expect(state.bindings[0]).toMatchObject({
      externalOwnershipKey: null,
      retainedExternalOwnershipKey: active.externalOwnershipKey,
      tombstoneRetainUntil: new Date(retainUntil)
    });

    let staleReplacement = bindingProjection({
      provisionedTenantAppId: 'binding-2',
      generation: 3
    });
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(staleReplacement, staleReplacement.provisionedTenantAppId)
      )
    ).rejects.toMatchObject({ code: 'binding_reprovision_required' });

    state.receiver.triggers[0].registrationGeneration = 5;
    let fabricatedManagedCredential = bindingProjection({
      provisionedTenantAppId: 'binding-2',
      generation: 3,
      hubReceiverGeneration: 5,
      credentialSecretId: 'fresh-binding-secret',
      credentialVersion: 2
    });
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(
          fabricatedManagedCredential,
          fabricatedManagedCredential.provisionedTenantAppId
        )
      )
    ).rejects.toMatchObject({ code: 'binding_credential_authority_mismatch' });
    let replacement = bindingProjection({
      provisionedTenantAppId: 'binding-2',
      generation: 3,
      hubReceiverGeneration: 5
    });
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(replacement, replacement.provisionedTenantAppId)
      )
    ).resolves.toMatchObject({ generation: 3 });
    expect(state.bindings).toHaveLength(2);

    let revivedOldId = bindingProjection({
      generation: 3,
      hubReceiverGeneration: 5
    });
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(revivedOldId, revivedOldId.provisionedTenantAppId)
      )
    ).rejects.toMatchObject({ code: 'binding_reprovision_required' });
  });

  it('keeps a BYO rebind pending until the exact new source secret exists, then activates idempotently', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(
      envelope(route, route.provisionedRouteId),
      new Date('2026-08-15T01:00:00.000Z')
    );
    let old = bindingProjection({
      provisionedTenantAppId: 'binding-byo-old',
      credentialOwnerType: 'byo',
      credentialOwnerRef: 'tenant-credentials-1',
      credentialSecretId: 'tenant-secret-1',
      credentialVersion: 1
    });
    state.triggerSecret = {
      id: old.credentialSecretId,
      secretVersion: old.credentialVersion,
      tenantOid: state.receiver.tenantOid,
      receiverOid: state.receiver.oid,
      receiverTriggerOid: state.receiver.triggers[0].oid,
      specHash: old.triggerSpecHash,
      sourceBindingType: 'provisioned_app',
      sourceBindingId: old.provisionedTenantAppId,
      name: 'vendor_verification',
      status: 'active',
      validFrom: new Date('2026-08-15T00:00:00.000Z'),
      validUntil: null
    };
    await projectSlateProvisionedTenantApp(envelope(old, old.provisionedTenantAppId));
    let tombstone = {
      ...old,
      generation: 2,
      status: 'tombstoned',
      tombstone: true,
      tombstoneRetainUntil: new Date('2026-09-15T00:00:00.000Z').toISOString()
    };
    await projectSlateProvisionedTenantApp(
      envelope(tombstone, tombstone.provisionedTenantAppId)
    );

    state.receiver.triggers[0].registrationGeneration = 5;
    let pending = {
      ...old,
      provisionedTenantAppId: 'binding-byo-replacement',
      hubReceiverGeneration: 5,
      credentialSecretId: 'tenant-secret-2',
      credentialVersion: 2,
      generation: 3,
      status: 'pending',
      tombstone: false,
      tombstoneRetainUntil: null
    };
    await expect(
      projectSlateProvisionedTenantApp(envelope(pending, pending.provisionedTenantAppId))
    ).resolves.toMatchObject({ generation: 3 });
    expect(state.bindings.at(-1)).toMatchObject({ status: 'pending', generation: 3 });

    Object.assign(state.bindings.at(-1), {
      routeProjection: state.routes[0],
      tenant: state.receiver.tenant,
      receiver: state.receiver,
      receiverTrigger: state.receiver.triggers[0]
    });
    let validateInput = {
      provisionedTenantAppId: pending.provisionedTenantAppId,
      hubTenantId: pending.hubTenantId,
      callbackInstanceId: pending.callbackInstanceId,
      provisionedRouteId: pending.provisionedRouteId,
      routeGeneration: pending.routeGeneration,
      vendor: pending.vendor,
      credentialOwnerRef: pending.credentialOwnerRef,
      credentialSecretId: pending.credentialSecretId,
      credentialSecretPurpose: pending.credentialSecretPurpose,
      credentialVersion: pending.credentialVersion,
      hubReceiverId: pending.hubReceiverId,
      hubReceiverGeneration: pending.hubReceiverGeneration,
      hubReceiverTriggerId: pending.hubReceiverTriggerId,
      triggerActionId: pending.triggerActionId,
      triggerSpecHash: pending.triggerSpecHash,
      now: new Date('2026-08-15T01:00:00.000Z')
    };
    await expect(
      validateProvisionedTenantCredentialSecret(validateInput)
    ).rejects.toMatchObject({ code: 'binding_credential_authority_mismatch' });
    let active = { ...pending, generation: 4, status: 'active' };
    await expect(
      projectSlateProvisionedTenantApp(envelope(active, active.provisionedTenantAppId))
    ).rejects.toMatchObject({ code: 'binding_credential_authority_mismatch' });
    expect(state.bindings.at(-1)).toMatchObject({ status: 'pending', generation: 3 });

    state.triggerSecret = {
      ...state.triggerSecret,
      id: pending.credentialSecretId,
      secretVersion: pending.credentialVersion,
      sourceBindingId: pending.provisionedTenantAppId
    };
    await expect(validateProvisionedTenantCredentialSecret(validateInput)).resolves.toEqual({
      valid: true
    });
    await expect(
      projectSlateProvisionedTenantApp(envelope(active, active.provisionedTenantAppId))
    ).resolves.toMatchObject({ generation: 4 });
    await expect(
      projectSlateProvisionedTenantApp(envelope(active, active.provisionedTenantAppId))
    ).resolves.toMatchObject({ generation: 4, idempotent: true });

    let revivedOldId = {
      ...active,
      provisionedTenantAppId: old.provisionedTenantAppId,
      generation: 3
    };
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(revivedOldId, revivedOldId.provisionedTenantAppId)
      )
    ).rejects.toMatchObject({ code: 'binding_reprovision_required' });

    state.receiver.triggers[0].registrationGeneration = 6;
    let oldKeyTakeover = {
      ...pending,
      provisionedTenantAppId: 'binding-byo-takeover',
      hubReceiverGeneration: 6,
      credentialSecretId: 'tenant-secret-3',
      credentialVersion: 3,
      generation: 5
    };
    await expect(
      projectSlateProvisionedTenantApp(
        envelope(oldKeyTakeover, oldKeyTakeover.provisionedTenantAppId)
      )
    ).rejects.toMatchObject({ code: 'external_ownership_conflict' });
  });

  it('resolves a tenant only from the authenticated external identity key', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(
      envelope(route, route.provisionedRouteId),
      new Date('2026-08-15T01:00:00.000Z')
    );
    let binding = bindingProjection();
    await projectSlateProvisionedTenantApp(envelope(binding, binding.provisionedTenantAppId));
    state.bindings[0].routeProjectionId = state.routes[0].id;
    state.bindings[0].tenant = state.receiver.tenant;
    state.bindings[0].routeProjection = state.routes[0];
    state.bindings[0].receiver = state.receiver;
    state.bindings[0].receiverTrigger = state.receiver.triggers[0];
    await expect(
      resolveActiveSlateProvisionedTenantApp({
        routeProjectionId: state.routes[0].id,
        authenticatedExternalOwnershipKey: binding.externalOwnershipKey
      })
    ).resolves.toMatchObject({ provisionedTenantAppId: 'binding-1' });
    await expect(
      resolveActiveSlateProvisionedTenantApp({
        routeProjectionId: state.routes[0].id,
        authenticatedExternalOwnershipKey: 'payload-selected-tenant'
      })
    ).rejects.toMatchObject({ code: 'binding_projection_not_ready' });
  });

  it('rejects ingress-disabled, tombstoned, and non-webhook shared-app triggers', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(
      envelope(route, route.provisionedRouteId),
      new Date('2026-08-15T01:00:00.000Z')
    );
    let binding = bindingProjection();
    await projectSlateProvisionedTenantApp(envelope(binding, binding.provisionedTenantAppId));
    Object.assign(state.bindings[0], {
      routeProjectionId: state.routes[0].id,
      routeProjection: state.routes[0],
      tenant: state.receiver.tenant,
      receiver: state.receiver,
      receiverTrigger: state.receiver.triggers[0]
    });
    let resolve = () =>
      resolveActiveSlateProvisionedTenantApp({
        routeProjectionId: state.routes[0].id,
        authenticatedExternalOwnershipKey: binding.externalOwnershipKey,
        now: new Date('2026-08-15T01:00:00.000Z')
      });

    await expect(resolve()).resolves.toMatchObject({ provisionedTenantAppId: 'binding-1' });
    expect(bindingProjectionDelegate.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          receiverTrigger: {
            source: 'webhook',
            tombstonedAt: null,
            ingressDisabledAt: null
          }
        })
      })
    );

    state.receiver.triggers[0].ingressDisabledAt = new Date('2026-08-15T00:30:00.000Z');
    await expect(resolve()).rejects.toMatchObject({ code: 'binding_projection_stale' });
    state.receiver.triggers[0].ingressDisabledAt = null;

    state.receiver.triggers[0].tombstonedAt = new Date('2026-08-15T00:30:00.000Z');
    await expect(resolve()).rejects.toMatchObject({ code: 'binding_projection_stale' });
    state.receiver.triggers[0].tombstonedAt = null;

    state.receiver.triggers[0].source = 'polling';
    await expect(resolve()).rejects.toMatchObject({ code: 'binding_projection_stale' });
  });

  it('re-resolves route, callback, spec, and credential authority at runtime', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(
      envelope(route, route.provisionedRouteId),
      new Date('2026-08-15T01:00:00.000Z')
    );
    let binding = bindingProjection();
    await projectSlateProvisionedTenantApp(envelope(binding, binding.provisionedTenantAppId));
    Object.assign(state.bindings[0], {
      routeProjectionId: state.routes[0].id,
      routeProjection: state.routes[0],
      tenant: state.receiver.tenant,
      receiver: state.receiver,
      receiverTrigger: state.receiver.triggers[0]
    });
    let resolve = () =>
      resolveActiveSlateProvisionedTenantApp({
        routeProjectionId: state.routes[0].id,
        authenticatedExternalOwnershipKey: binding.externalOwnershipKey,
        now: new Date('2026-08-15T01:00:00.000Z')
      });
    await expect(resolve()).resolves.toMatchObject({ provisionedTenantAppId: 'binding-1' });

    state.routes[0].generation++;
    await expect(resolve()).rejects.toMatchObject({ code: 'binding_projection_stale' });
    state.routes[0].generation--;
    state.receiver.callbackInstanceId = 'other-callback';
    await expect(resolve()).rejects.toMatchObject({ code: 'binding_projection_stale' });
    state.receiver.callbackInstanceId = 'callback-1';
    state.receiver.triggers[0].action.spec.specHash = 'stale-published-hash';
    await expect(resolve()).rejects.toMatchObject({ code: 'binding_projection_stale' });
    state.receiver.triggers[0].action.spec.specHash = binding.triggerSpecHash;
    state.receiver.triggers[0].action.spec.invocation.http.ingress.verification.mechanism =
      'provider';
    await expect(resolve()).rejects.toMatchObject({ code: 'binding_projection_stale' });
    state.receiver.triggers[0].action.spec.invocation.http.ingress.verification.mechanism =
      'hub';
    state.bindings[0].credentialVersion = 9;
    await expect(resolve()).rejects.toMatchObject({
      code: 'binding_credential_authority_mismatch'
    });
  });

  it('validates BYO secrets only from the exact active Hub source binding and purpose', async () => {
    let route = routeProjection();
    await projectSlateProvisionedAppRoute(
      envelope(route, route.provisionedRouteId),
      new Date('2026-08-15T01:00:00.000Z')
    );
    state.triggerSecret = {
      id: 'tenant-secret-1',
      secretVersion: 7,
      tenantOid: state.receiver.tenantOid,
      receiverOid: state.receiver.oid,
      receiverTriggerOid: state.receiver.triggers[0].oid,
      specHash: state.receiver.triggers[0].action.spec.specHash,
      sourceBindingType: 'provisioned_app',
      sourceBindingId: 'binding-byo',
      name: 'vendor_verification',
      status: 'active',
      validFrom: new Date('2026-08-15T00:00:00.000Z'),
      validUntil: null
    };
    let binding = bindingProjection({
      provisionedTenantAppId: 'binding-byo',
      credentialOwnerType: 'byo',
      credentialOwnerRef: 'tenant-credentials-1',
      credentialSecretId: 'tenant-secret-1',
      credentialVersion: 7
    });
    await projectSlateProvisionedTenantApp(envelope(binding, binding.provisionedTenantAppId));
    Object.assign(state.bindings[0], {
      routeProjection: state.routes[0],
      tenant: state.receiver.tenant,
      receiver: state.receiver,
      receiverTrigger: state.receiver.triggers[0]
    });
    let input = {
      provisionedTenantAppId: binding.provisionedTenantAppId,
      hubTenantId: binding.hubTenantId,
      callbackInstanceId: binding.callbackInstanceId,
      provisionedRouteId: binding.provisionedRouteId,
      routeGeneration: binding.routeGeneration,
      vendor: binding.vendor,
      credentialOwnerRef: binding.credentialOwnerRef,
      credentialSecretId: binding.credentialSecretId,
      credentialSecretPurpose: binding.credentialSecretPurpose,
      credentialVersion: binding.credentialVersion,
      hubReceiverId: binding.hubReceiverId,
      hubReceiverGeneration: binding.hubReceiverGeneration,
      hubReceiverTriggerId: binding.hubReceiverTriggerId,
      triggerActionId: binding.triggerActionId,
      triggerSpecHash: binding.triggerSpecHash,
      now: new Date('2026-08-15T01:00:00.000Z')
    };
    await expect(validateProvisionedTenantCredentialSecret(input)).resolves.toEqual({
      valid: true
    });

    for (let [field, value] of [
      ['credentialSecretPurpose', 'callback_signing'],
      ['credentialOwnerRef', 'other-owner'],
      ['hubTenantId', 'other-tenant'],
      ['vendor', 'github'],
      ['credentialVersion', 8]
    ] as const) {
      await expect(
        validateProvisionedTenantCredentialSecret({ ...input, [field]: value } as never)
      ).rejects.toMatchObject({ code: 'binding_credential_authority_mismatch' });
    }
    state.triggerSecret.sourceBindingType = 'managed_backing';
    await expect(validateProvisionedTenantCredentialSecret(input)).rejects.toMatchObject({
      code: 'binding_credential_authority_mismatch'
    });
    state.triggerSecret.sourceBindingType = 'provisioned_app';
    state.triggerSecret.status = 'revoked';
    await expect(validateProvisionedTenantCredentialSecret(input)).rejects.toMatchObject({
      code: 'binding_credential_authority_mismatch'
    });
    state.triggerSecret.status = 'active';
    state.triggerSecret.validFrom = new Date('2026-08-15T02:00:00.000Z');
    await expect(validateProvisionedTenantCredentialSecret(input)).rejects.toMatchObject({
      code: 'binding_credential_authority_mismatch'
    });
  });
});
