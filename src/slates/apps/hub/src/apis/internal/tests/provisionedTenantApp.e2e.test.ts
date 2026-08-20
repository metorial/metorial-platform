import { beforeEach, describe, expect, it } from 'vitest';
import { computeWebhookActionSpecHashV1 } from '@slates/proto';
import {
  buildSlateProvisionedExternalOwnershipKey,
  digestSlateProvisionedProjection,
  projectSlateProvisionedAppRoute,
  projectSlateProvisionedTenantApp,
  resolveActiveSlateProvisionedTenantApp,
  slateTriggerReceiverSecretService,
  validateProvisionedTenantCredentialSecret
} from '../../../services';
import { cleanDatabase, testDb } from '../../../test/setup';
import { fixtures } from '../../../test/fixtures';

let envelope = <T extends { entityKind: 'route' | 'binding'; generation: number }>(
  projection: T,
  entityId: string
) => {
  let projectionDigest = digestSlateProvisionedProjection(projection);
  return {
    projection,
    projectionDigest,
    correlationId: `task13-e2e-${projection.generation}`,
    idempotencyKey: `provisioned-projection/v1:${projection.entityKind}:${entityId}:${projection.generation}:${projectionDigest}`
  };
};

let sharedActionSpec = () => {
  let spec: any = {
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
          routeFamily: 'github',
          verification: {
            mechanism: 'hub',
            allowedSecretRefs: [],
            rules: [
              {
                id: 'github.e2e.v1',
                phase: 'delivery',
                when: { methods: ['POST'] },
                verify: { type: 'preset', preset: 'github.sha256' },
                result: { type: 'event' },
                replay: { kind: 'not_applicable', reason: 'projection_e2e' }
              }
            ]
          }
        }
      }
    }
  };
  spec.specHash = computeWebhookActionSpecHashV1(spec);
  return spec;
};

describe('Task 13 provisioned-app database lifecycle', () => {
  let f = fixtures(testDb);

  beforeEach(async () => await cleanDatabase());

  it('persists exact route, managed and BYO bindings, route cascade, detach, and runtime re-resolution', async () => {
    let { receiver, receiverTrigger, triggerAction, tenant } =
      await f.slateTriggerReceiver.complete({
        slateIdentifier: 'task13-provisioned-app-e2e',
        receiverOverrides: { callbackInstanceId: 'callback-e2e' }
      });
    let spec = sharedActionSpec();
    await testDb.slateAction.update({
      where: { oid: triggerAction.oid },
      data: { spec }
    });
    await testDb.slateTriggerReceiverTrigger.update({
      where: { oid: receiverTrigger.oid },
      data: {
        registrationGeneration: 4,
        verificationMechanism: 'hub',
        verificationSpecHash: spec.specHash
      }
    });

    let route = {
      version: 1 as const,
      entityKind: 'route' as const,
      provisionedRouteId: 'route-e2e',
      routeIdentifier: 'selector-e2e',
      vendor: 'github',
      purpose: 'shared_provisioned_app',
      credentialOwnerRef: 'managed-owner-e2e',
      generation: 1,
      routeSecretId: 'route-path-secret-e2e',
      routeSecretVersion: 1,
      vendorVerificationSecretId: 'route-vendor-secret-e2e',
      vendorVerificationVersion: 1,
      status: 'active',
      tombstone: false,
      tombstoneRetainUntil: null,
      expiresAt: null
    };
    await projectSlateProvisionedAppRoute(envelope(route, route.provisionedRouteId));
    for (let purpose of ['app_route_path', 'vendor_verification'] as const) {
      await slateTriggerReceiverSecretService.createOrRotateAppRouteSecret({
        provisionedRouteId: route.provisionedRouteId,
        routeGeneration: route.generation,
        vendor: route.vendor,
        credentialOwnerRef: route.credentialOwnerRef,
        purpose,
        ...(purpose === 'vendor_verification' ? { importedValue: 'github-e2e-secret' } : {}),
        actor: { actorId: 'task13-e2e', requestId: `route-${purpose}` }
      });
    }

    let ownership = {
      vendor: route.vendor,
      externalAppId: 'github-app-e2e',
      externalAccountId: 'github-account-e2e',
      externalInstallationId: 'github-installation-e2e'
    };
    let managed = {
      version: 1 as const,
      entityKind: 'binding' as const,
      provisionedTenantAppId: 'binding-managed-e2e',
      provisionedRouteId: route.provisionedRouteId,
      routeIdentifier: route.routeIdentifier,
      routeGeneration: route.generation,
      hubTenantId: tenant.id,
      callbackInstanceId: 'callback-e2e',
      hubReceiverId: receiver.id,
      hubReceiverGeneration: 4,
      hubReceiverTriggerId: receiverTrigger.id,
      triggerActionId: triggerAction.key,
      triggerSpecHash: spec.specHash,
      ...ownership,
      purpose: 'shared_provisioned_app',
      externalOwnershipKey: buildSlateProvisionedExternalOwnershipKey(ownership),
      ownerIdentity: 'organization:metorial',
      credentialOwnerType: 'managed' as const,
      credentialOwnerRef: route.credentialOwnerRef,
      credentialSecretId: route.vendorVerificationSecretId,
      credentialSecretPurpose: 'vendor_verification' as const,
      credentialVersion: route.vendorVerificationVersion,
      generation: 1,
      status: 'active',
      tombstone: false,
      tombstoneRetainUntil: null,
      expiresAt: null
    };
    await projectSlateProvisionedTenantApp(envelope(managed, managed.provisionedTenantAppId));
    let routeRow = await testDb.slateProvisionedAppRouteProjection.findUniqueOrThrow({
      where: { provisionedRouteId: route.provisionedRouteId }
    });
    await expect(
      resolveActiveSlateProvisionedTenantApp({
        routeProjectionId: routeRow.id,
        authenticatedExternalOwnershipKey: managed.externalOwnershipKey
      })
    ).resolves.toMatchObject({ provisionedTenantAppId: managed.provisionedTenantAppId });

    let byoOwnership = {
      vendor: route.vendor,
      externalAppId: 'github-app-byo-e2e',
      externalAccountId: 'github-account-byo-e2e',
      externalInstallationId: 'github-installation-byo-e2e'
    };
    let byoPending = {
      ...managed,
      provisionedTenantAppId: 'binding-byo-e2e',
      ...byoOwnership,
      externalOwnershipKey: buildSlateProvisionedExternalOwnershipKey(byoOwnership),
      credentialOwnerType: 'byo' as const,
      credentialOwnerRef: 'tenant-credential-e2e',
      credentialSecretId: 'tenant-vendor-secret-e2e',
      credentialVersion: 1,
      status: 'pending'
    };
    await projectSlateProvisionedTenantApp(
      envelope(byoPending, byoPending.provisionedTenantAppId)
    );
    await expect(
      slateTriggerReceiverSecretService.createOrRotateProvisionedTenantAppSecret({
        provisionedTenantAppId: byoPending.provisionedTenantAppId,
        plaintext: 'task13-byo-verification-secret',
        actor: { actorId: 'task13-e2e', requestId: 'byo-import' }
      })
    ).resolves.toMatchObject({
      secret: {
        id: byoPending.credentialSecretId,
        secretVersion: byoPending.credentialVersion,
        status: 'active',
        sourceBindingId: byoPending.provisionedTenantAppId,
        name: 'vendor_verification'
      },
      idempotent: false
    });
    let byo = { ...byoPending, generation: 2, status: 'active' };
    await projectSlateProvisionedTenantApp(envelope(byo, byo.provisionedTenantAppId));
    await expect(
      validateProvisionedTenantCredentialSecret({
        provisionedTenantAppId: byo.provisionedTenantAppId,
        hubTenantId: byo.hubTenantId,
        callbackInstanceId: byo.callbackInstanceId,
        provisionedRouteId: byo.provisionedRouteId,
        routeGeneration: byo.routeGeneration,
        vendor: byo.vendor,
        credentialOwnerRef: byo.credentialOwnerRef,
        credentialSecretId: byo.credentialSecretId,
        credentialSecretPurpose: byo.credentialSecretPurpose,
        credentialVersion: byo.credentialVersion,
        hubReceiverId: byo.hubReceiverId,
        hubReceiverGeneration: byo.hubReceiverGeneration,
        hubReceiverTriggerId: byo.hubReceiverTriggerId,
        triggerActionId: byo.triggerActionId,
        triggerSpecHash: byo.triggerSpecHash,
        now: new Date(Date.now() + 1_000)
      })
    ).resolves.toEqual({ valid: true });

    let rotatedRoute = {
      ...route,
      generation: 2,
      routeSecretId: 'route-path-secret-e2e-2',
      vendorVerificationSecretId: 'route-vendor-secret-e2e-2'
    };
    await projectSlateProvisionedAppRoute(
      envelope(rotatedRoute, rotatedRoute.provisionedRouteId)
    );
    for (let purpose of ['app_route_path', 'vendor_verification'] as const) {
      await slateTriggerReceiverSecretService.createOrRotateAppRouteSecret({
        provisionedRouteId: rotatedRoute.provisionedRouteId,
        routeGeneration: rotatedRoute.generation,
        vendor: rotatedRoute.vendor,
        credentialOwnerRef: rotatedRoute.credentialOwnerRef,
        purpose,
        ...(purpose === 'vendor_verification' ? { importedValue: 'github-e2e-secret-2' } : {}),
        actor: { actorId: 'task13-e2e', requestId: `route-2-${purpose}` }
      });
    }
    let retainUntil = new Date('2026-09-15T00:00:00.000Z').toISOString();
    await projectSlateProvisionedTenantApp(
      envelope(
        {
          ...managed,
          routeGeneration: 2,
          generation: 2,
          status: 'tombstoned',
          tombstone: true,
          tombstoneRetainUntil: retainUntil
        },
        managed.provisionedTenantAppId
      )
    );
    await projectSlateProvisionedTenantApp(
      envelope({ ...byo, routeGeneration: 2, generation: 3 }, byo.provisionedTenantAppId)
    );
    await expect(
      resolveActiveSlateProvisionedTenantApp({
        routeProjectionId: routeRow.id,
        authenticatedExternalOwnershipKey: managed.externalOwnershipKey
      })
    ).rejects.toThrow();
    await expect(
      resolveActiveSlateProvisionedTenantApp({
        routeProjectionId: routeRow.id,
        authenticatedExternalOwnershipKey: byo.externalOwnershipKey
      })
    ).resolves.toMatchObject({ provisionedTenantAppId: byo.provisionedTenantAppId });
  });
});
