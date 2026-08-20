import { createHmac } from 'node:crypto';
import { computeWebhookActionSpecHashV1, type WebhookWireRequest } from '@slates/proto';
import { describe, expect, it, vi } from 'vitest';
import {
  normalizeSharedAppPublicRejection,
  routeSharedAppWebhook,
  type SharedAppBindingProjection,
  type SharedAppResolvedSecret,
  type SharedAppRouteProjection,
  type SharedAppRoutingDependencies
} from '.';
import { computeWebhookStateHash, executeExactWebhookPipeline } from '../webhookVerification';

let NOW = new Date('2026-08-14T12:00:00.000Z');
let ROUTE_DIGEST = `sha256:${'a'.repeat(64)}`;
let BINDING_DIGEST = `sha256:${'b'.repeat(64)}`;

let actionContract = () => {
  let action: any = {
    id: 'events',
    type: 'action.trigger',
    capabilities: {},
    inputSchema: { type: 'object', additionalProperties: true },
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
                id: 'delivery.v1',
                phase: 'delivery',
                when: { methods: ['POST'], registrationStatuses: ['registered'] },
                verify: { type: 'preset', preset: 'slack.v0' },
                result: { type: 'dispatch', scope: 'receiver_trigger' },
                replay: {
                  kind: 'enforced',
                  freshness: {
                    source: 'preset',
                    presetField: 'timestamp',
                    format: 'unix_seconds',
                    maxAgeSeconds: 300,
                    maxFutureSkewSeconds: 30
                  },
                  deduplicate: {
                    source: 'header',
                    headerName: 'x-slack-request-timestamp',
                    ttlSeconds: 3600,
                    scope: 'request'
                  }
                }
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

let route = (): SharedAppRouteProjection => ({
  oid: 1n,
  id: 'route-row-1',
  provisionedRouteId: 'route-1',
  routeIdentifier: 'slack-main',
  vendor: 'slack',
  purpose: 'shared_provisioned_app',
  credentialOwnerRef: 'managed-slack-app',
  generation: 3,
  routeSecretId: 'path-current',
  routeSecretVersion: 2,
  vendorVerificationSecretId: 'vendor-current',
  vendorVerificationVersion: 4,
  status: 'active',
  projectionDigest: ROUTE_DIGEST,
  tombstonedAt: null,
  expiresAt: null
});

let binding = (): SharedAppBindingProjection => {
  let selectedRoute = route();
  let action = actionContract();
  return {
    routeProjectionOid: selectedRoute.oid,
    tenantOid: 10n,
    receiverOid: 20n,
    receiverTriggerOid: 30n,
    id: 'binding-row-1',
    provisionedTenantAppId: 'binding-1',
    routeIdentifier: selectedRoute.routeIdentifier,
    routeGeneration: selectedRoute.generation,
    hubReceiverGeneration: 7,
    callbackInstanceId: 'callback-instance-1',
    triggerActionId: 'events',
    triggerSpecHash: action.specHash,
    vendor: selectedRoute.vendor,
    purpose: selectedRoute.purpose,
    externalOwnershipKey: 'owner:slack:A1:T1',
    generation: 5,
    status: 'active',
    projectionDigest: BINDING_DIGEST,
    tombstonedAt: null,
    expiresAt: null,
    routeProjection: selectedRoute,
    tenant: { oid: 10n, id: 'tenant-1' },
    receiver: {
      oid: 20n,
      tenantOid: 10n,
      id: 'receiver-1',
      status: 'active',
      callbackInstanceId: 'callback-instance-1',
      tombstonedAt: null
    },
    receiverTrigger: {
      oid: 30n,
      receiverOid: 20n,
      id: 'trigger-1',
      registrationGeneration: 7,
      verificationMechanism: 'hub',
      verificationSpecHash: action.specHash,
      tombstonedAt: null,
      action: { key: 'events', spec: action }
    }
  };
};

let secret = (d: {
  purpose: 'app_route_path' | 'vendor_verification';
  id: string;
  version: number;
  plaintext: string;
  status?: 'active' | 'retiring';
  validUntil?: Date | null;
  generation?: number;
}): SharedAppResolvedSecret => ({
  secret: {
    id: d.id,
    provisionedRouteId: 'route-1',
    routeGeneration: d.generation ?? 3,
    vendor: 'slack',
    credentialOwnerRef: 'managed-slack-app',
    purpose: d.purpose,
    secretVersion: d.version,
    status: d.status ?? 'active',
    validFrom: new Date('2026-08-01T00:00:00.000Z'),
    validUntil: d.validUntil ?? null
  },
  plaintext: d.plaintext
});

let signedSlackRequest = (
  bodyValue: Record<string, unknown> = {
    api_app_id: 'A1',
    team_id: 'T1',
    tenantId: 'attacker-selected-tenant'
  },
  key = 'vendor-signing-secret'
): WebhookWireRequest => {
  let body = JSON.stringify(bodyValue);
  let timestamp = String(Math.floor(NOW.getTime() / 1000));
  let signature = createHmac('sha256', key).update(`v0:${timestamp}:${body}`).digest('hex');
  return {
    url: 'https://hub.example/slates-hub/triggers/shared-app/slack-main/path-secret?tenantId=evil',
    method: 'POST',
    headers: [
      ['content-type', 'application/json'],
      ['x-slack-request-timestamp', timestamp],
      ['x-slack-signature', `v0=${signature}`],
      ['x-tenant-id', 'evil']
    ],
    body: { present: true, base64: Buffer.from(body).toString('base64') }
  };
};

let vendorProjection = (
  family: 'zoom' | 'hubspot',
  preset: 'zoom.v0' | 'hubspot.v3',
  externalOwnershipKey: string
) => {
  let selectedRoute = {
    ...route(),
    routeIdentifier: `${family}-main`,
    vendor: family
  };
  let action = actionContract();
  action.invocation.http.ingress.routeFamily = family;
  action.invocation.http.ingress.verification.rules[0].verify.preset = preset;
  action.specHash = computeWebhookActionSpecHashV1(action);
  let selectedBinding = binding();
  selectedBinding = {
    ...selectedBinding,
    routeIdentifier: selectedRoute.routeIdentifier,
    vendor: family,
    externalOwnershipKey,
    triggerSpecHash: action.specHash,
    routeProjection: selectedRoute,
    receiverTrigger: {
      ...selectedBinding.receiverTrigger,
      verificationSpecHash: action.specHash,
      action: { key: action.id, spec: action }
    }
  };
  let forRoute = (value: SharedAppResolvedSecret): SharedAppResolvedSecret => ({
    ...value,
    secret: { ...value.secret, vendor: family }
  });
  return { selectedRoute, selectedBinding, forRoute };
};

let signedZoomRequest = (key = 'vendor-signing-secret'): WebhookWireRequest => {
  let body = JSON.stringify({ event: 'meeting.created', payload: { account_id: 'ZA1' } });
  let timestamp = String(Math.floor(NOW.getTime() / 1000));
  let signature = createHmac('sha256', key).update(`v0:${timestamp}:${body}`).digest('hex');
  return {
    url: 'https://hub.example/slates-hub/triggers/shared-app/zoom-main/path-secret',
    method: 'POST',
    headers: [
      ['content-type', 'application/json'],
      ['x-zm-request-timestamp', timestamp],
      ['x-zm-signature', `v0=${signature}`]
    ],
    body: { present: true, base64: Buffer.from(body).toString('base64') }
  };
};

let signedHubSpotRequest = (
  bodyValue: unknown = [{ appId: 42, portalId: 84, subscriptionType: 'contact.creation' }],
  key = 'vendor-signing-secret'
): WebhookWireRequest => {
  let url = 'https://hub.example/slates-hub/triggers/shared-app/hubspot-main/path-secret';
  let body = JSON.stringify(bodyValue);
  let timestamp = String(NOW.getTime());
  let signature = createHmac('sha256', key)
    .update(`POST${url}${body}${timestamp}`)
    .digest('base64');
  return {
    url,
    method: 'POST',
    headers: [
      ['content-type', 'application/json'],
      ['x-hubspot-request-timestamp', timestamp],
      ['x-hubspot-signature-v3', signature]
    ],
    body: { present: true, base64: Buffer.from(body).toString('base64') }
  };
};

let harness = (
  overrides: {
    route?: SharedAppRouteProjection;
    binding?: SharedAppBindingProjection;
    pathSecrets?: SharedAppResolvedSecret[];
    vendorSecrets?: SharedAppResolvedSecret[];
    request?: WebhookWireRequest;
  } = {}
) => {
  let selectedRoute = overrides.route ?? route();
  let selectedBinding = overrides.binding ?? binding();
  let pathSecrets = overrides.pathSecrets ?? [
    secret({
      purpose: 'app_route_path',
      id: 'path-current',
      version: 2,
      plaintext: 'path-secret'
    })
  ];
  let vendorSecrets = overrides.vendorSecrets ?? [
    secret({
      purpose: 'vendor_verification',
      id: 'vendor-current',
      version: 4,
      plaintext: 'vendor-signing-secret'
    })
  ];
  let calls: string[] = [];
  let resolveBinding = vi.fn(async () => {
    calls.push('binding');
    return selectedBinding;
  });
  let dispatch = vi.fn(async () => {
    calls.push('dispatch');
    return { status: 'accepted' as const, webhookRequestId: 'request-1' };
  });
  let dependencies: SharedAppRoutingDependencies = {
    resolveRoute: vi.fn(async selector => {
      calls.push(`route:${selector}`);
      return selectedRoute;
    }),
    resolveRouteSecrets: vi.fn(async ({ purpose }) => {
      calls.push(`secret:${purpose}`);
      return purpose === 'app_route_path' ? pathSecrets : vendorSecrets;
    }),
    buildExternalOwnershipKey: vi.fn(identity => {
      calls.push('identity');
      return `owner:${identity.vendor}:${identity.externalAppId}:${identity.externalAccountId}`;
    }),
    resolveBinding,
    dispatch,
    now: () => NOW
  };
  return {
    dependencies,
    resolveBinding,
    dispatch,
    calls,
    request: overrides.request ?? signedSlackRequest()
  };
};

describe('shared app routing boundary', () => {
  it('normalizes selector, credential, and binding failures at the public boundary', () => {
    expect(
      normalizeSharedAppPublicRejection({
        status: 'rejected',
        code: 'routing_projection_unavailable'
      })
    ).toEqual(
      normalizeSharedAppPublicRejection({
        status: 'rejected',
        code: 'credential_invalid'
      })
    );
    expect(
      normalizeSharedAppPublicRejection({
        status: 'rejected',
        code: 'baseline_path_invalid'
      })
    ).toEqual({ status: 404, body: 'Not Found' });
  });

  it('keeps the public route selector separate from the constant-time path credential', async () => {
    let run = harness();
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'slack-main',
      request: run.request,
      dependencies: run.dependencies
    });
    expect(result).toEqual({ status: 'rejected', code: 'baseline_path_invalid' });
    expect(run.calls).toEqual(['route:slack-main', 'secret:app_route_path']);
    expect(run.resolveBinding).not.toHaveBeenCalled();
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it('accepts active and bounded retiring path secrets during rotation', async () => {
    let run = harness({
      pathSecrets: [
        secret({
          purpose: 'app_route_path',
          id: 'path-current',
          version: 2,
          plaintext: 'new-path'
        }),
        secret({
          purpose: 'app_route_path',
          id: 'path-old',
          version: 1,
          plaintext: 'old-path',
          status: 'retiring',
          validUntil: new Date(NOW.getTime() + 60_000)
        })
      ]
    });
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'old-path',
      request: run.request,
      dependencies: run.dependencies
    });
    expect(result).toMatchObject({ status: 'accepted' });
    expect(run.calls).toEqual([
      'route:slack-main',
      'secret:app_route_path',
      'secret:vendor_verification',
      'identity',
      'binding',
      'dispatch'
    ]);
  });

  it('rejects an unprojected active credential instead of widening a rotation set', async () => {
    let run = harness({
      pathSecrets: [
        secret({
          purpose: 'app_route_path',
          id: 'path-current',
          version: 2,
          plaintext: 'current-path'
        }),
        secret({
          purpose: 'app_route_path',
          id: 'path-unprojected',
          version: 3,
          plaintext: 'unprojected-path'
        })
      ]
    });
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'unprojected-path',
      request: run.request,
      dependencies: run.dependencies
    });
    expect(result).toEqual({ status: 'rejected', code: 'baseline_path_invalid' });
    expect(run.resolveBinding).not.toHaveBeenCalled();
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it('rejects missing, expired, and wrong-generation route credentials before tenant lookup', async () => {
    let cases: SharedAppResolvedSecret[][] = [
      [],
      [
        secret({
          purpose: 'app_route_path',
          id: 'path-current',
          version: 2,
          plaintext: 'path-secret',
          status: 'retiring',
          validUntil: NOW
        })
      ],
      [
        secret({
          purpose: 'app_route_path',
          id: 'path-current',
          version: 2,
          plaintext: 'path-secret',
          generation: 2
        })
      ]
    ];
    for (let pathSecrets of cases) {
      let run = harness({ pathSecrets });
      let result = await routeSharedAppWebhook({
        routeIdentifier: 'slack-main',
        suppliedPathSecret: 'path-secret',
        request: run.request,
        dependencies: run.dependencies
      });
      expect(result).toEqual({ status: 'rejected', code: 'baseline_path_invalid' });
      expect(run.resolveBinding).not.toHaveBeenCalled();
    }
  });

  it('rejects a wrong vendor credential generation before tenant lookup', async () => {
    let run = harness({
      vendorSecrets: [
        secret({
          purpose: 'vendor_verification',
          id: 'vendor-current',
          version: 4,
          plaintext: 'vendor-signing-secret',
          generation: 2
        })
      ]
    });
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'path-secret',
      request: run.request,
      dependencies: run.dependencies
    });
    expect(result).toEqual({ status: 'rejected', code: 'routing_projection_stale' });
    expect(run.resolveBinding).not.toHaveBeenCalled();
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it('does not resolve a binding for an invalid complete vendor signature', async () => {
    let run = harness({ request: signedSlackRequest(undefined, 'wrong-key') });
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'path-secret',
      request: run.request,
      dependencies: run.dependencies
    });
    expect(result).toEqual({ status: 'rejected', code: 'credential_invalid' });
    expect(run.resolveBinding).not.toHaveBeenCalled();
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it('uses only the signed vendor identity and ignores payload/query/header tenant injection', async () => {
    let run = harness();
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'path-secret',
      request: run.request,
      dependencies: run.dependencies
    });
    expect(result).toEqual({
      status: 'accepted',
      webhookRequestId: 'request-1'
    });
    expect(run.dependencies.buildExternalOwnershipKey).toHaveBeenCalledWith({
      vendor: 'slack',
      externalAppId: 'A1',
      externalAccountId: 'T1'
    });
    expect(run.resolveBinding).toHaveBeenCalledWith({
      routeProjectionId: 'route-row-1',
      authenticatedExternalOwnershipKey: 'owner:slack:A1:T1'
    });
    let dispatched = run.dispatch.mock.calls[0]![0];
    expect(dispatched.boundary).toMatchObject({
      tenantId: 'tenant-1',
      receiverId: 'receiver-1',
      receiverTriggerId: 'trigger-1',
      routeGeneration: 3,
      bindingGeneration: 5,
      specHash: binding().triggerSpecHash
    });
    expect(dispatched.boundary.bindingHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(dispatched.boundary)).toBe(true);
    expect(Object.isFrozen(dispatched.boundary.authenticatedPathSecrets)).toBe(true);
    expect(Object.isFrozen(dispatched.boundary.authenticatedVendorSecrets)).toBe(true);
    expect(Object.isFrozen(dispatched.boundary.vendorSecrets)).toBe(true);
    expect(Object.isFrozen(dispatched.boundary.vendorSecrets[0])).toBe(true);
  });

  it('authenticates Zoom canonically and derives only its signed account identity', async () => {
    let vendor = vendorProjection('zoom', 'zoom.v0', 'owner:zoom:undefined:ZA1');
    let pathSecret = vendor.forRoute(
      secret({
        purpose: 'app_route_path',
        id: 'path-current',
        version: 2,
        plaintext: 'path-secret'
      })
    );
    let signingSecret = vendor.forRoute(
      secret({
        purpose: 'vendor_verification',
        id: 'vendor-current',
        version: 4,
        plaintext: 'vendor-signing-secret'
      })
    );
    let run = harness({
      route: vendor.selectedRoute,
      binding: vendor.selectedBinding,
      pathSecrets: [pathSecret],
      vendorSecrets: [signingSecret],
      request: signedZoomRequest()
    });
    await expect(
      routeSharedAppWebhook({
        routeIdentifier: 'zoom-main',
        suppliedPathSecret: 'path-secret',
        request: run.request,
        dependencies: run.dependencies
      })
    ).resolves.toMatchObject({ status: 'accepted' });
    expect(run.dependencies.buildExternalOwnershipKey).toHaveBeenCalledWith({
      vendor: 'zoom',
      externalAccountId: 'ZA1'
    });
  });

  it('authenticates HubSpot v3 canonically and requires one consistent signed app/account identity', async () => {
    let vendor = vendorProjection('hubspot', 'hubspot.v3', 'owner:hubspot:42:84');
    let pathSecret = vendor.forRoute(
      secret({
        purpose: 'app_route_path',
        id: 'path-current',
        version: 2,
        plaintext: 'path-secret'
      })
    );
    let signingSecret = vendor.forRoute(
      secret({
        purpose: 'vendor_verification',
        id: 'vendor-current',
        version: 4,
        plaintext: 'vendor-signing-secret'
      })
    );
    let run = harness({
      route: vendor.selectedRoute,
      binding: vendor.selectedBinding,
      pathSecrets: [pathSecret],
      vendorSecrets: [signingSecret],
      request: signedHubSpotRequest()
    });
    await expect(
      routeSharedAppWebhook({
        routeIdentifier: 'hubspot-main',
        suppliedPathSecret: 'path-secret',
        request: run.request,
        dependencies: run.dependencies
      })
    ).resolves.toMatchObject({ status: 'accepted' });
    expect(run.dependencies.buildExternalOwnershipKey).toHaveBeenCalledWith({
      vendor: 'hubspot',
      externalAppId: '42',
      externalAccountId: '84'
    });

    let mixed = harness({
      route: vendor.selectedRoute,
      binding: vendor.selectedBinding,
      pathSecrets: [pathSecret],
      vendorSecrets: [signingSecret],
      request: signedHubSpotRequest([
        { appId: 42, portalId: 84 },
        { appId: 42, portalId: 85 }
      ])
    });
    await expect(
      routeSharedAppWebhook({
        routeIdentifier: 'hubspot-main',
        suppliedPathSecret: 'path-secret',
        request: mixed.request,
        dependencies: mixed.dependencies
      })
    ).resolves.toEqual({ status: 'rejected', code: 'routing_projection_unavailable' });
    expect(mixed.resolveBinding).not.toHaveBeenCalled();
    expect(mixed.dispatch).not.toHaveBeenCalled();
  });

  it('enters Task 6 aggregation and the Task 7 atomic replay/outbox seam for the bound trigger only', async () => {
    let commit = vi.fn(async () => ({ status: 'committed' as const, commitId: 'commit-1' }));
    let run = harness();
    let dependencies: SharedAppRoutingDependencies = {
      ...run.dependencies,
      dispatch: async ({ boundary, request }) => {
        let contract = actionContract();
        let verification = contract.invocation.http.ingress.verification;
        let result = await executeExactWebhookPipeline({
          receiverId: boundary.receiverId,
          requestId: 'request-1',
          request,
          triggers: [
            {
              receiverId: boundary.receiverId,
              receiverTriggerId: boundary.receiverTriggerId,
              actionId: boundary.triggerActionId,
              specHash: boundary.specHash,
              registrationStatus: 'registered',
              registrationGeneration: boundary.receiverGeneration,
              registrationVersion: 11,
              verification,
              secrets: boundary.vendorSecrets,
              actionInputSchema: { type: 'object', additionalProperties: true },
              state: {},
              stateVersion: 11,
              stateHash: computeWebhookStateHash({}),
              sharedAppAuthority: {
                routeProjectionId: boundary.routeProjectionId,
                routeGeneration: boundary.routeGeneration,
                routeProjectionDigest: boundary.routeProjectionDigest,
                bindingProjectionId: boundary.bindingProjectionId,
                bindingGeneration: boundary.bindingGeneration,
                bindingProjectionDigest: boundary.bindingProjectionDigest,
                externalOwnershipKey: boundary.externalOwnershipKey,
                authenticatedPathSecrets: boundary.authenticatedPathSecrets,
                authenticatedVendorSecrets: boundary.authenticatedVendorSecrets,
                bindingHash: boundary.bindingHash
              }
            }
          ],
          dependencies: {
            verifyProvider: async () => {
              throw new Error('provider verifier must not run for a Hub preset');
            },
            mapProvider: async ({ bindings }) => ({
              bindings,
              inputs: [{ event: 'accepted' }]
            }),
            atomicCommit: { commit }
          },
          nowMs: NOW.getTime()
        });
        return result.status === 'rejected'
          ? { status: 'rejected' as const, code: result.code }
          : { status: 'accepted' as const, webhookRequestId: 'request-1' };
      }
    };
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'path-secret',
      request: run.request,
      dependencies
    });
    expect(result).toEqual({ status: 'accepted', webhookRequestId: 'request-1' });
    expect(commit).toHaveBeenCalledTimes(1);
    let committed = commit.mock.calls[0]![0];
    expect(committed.receiverId).toBe('receiver-1');
    expect(committed.dispatches).toHaveLength(1);
    expect(committed.dispatches[0].bindings).toMatchObject({
      receiverTriggerId: 'trigger-1',
      sharedAppAuthority: {
        routeProjectionId: 'route-1',
        bindingProjectionId: 'binding-1'
      }
    });
  });

  it('rejects a validly signed request with no securely bindable external identity', async () => {
    let request = signedSlackRequest({ type: 'event_callback', tenantId: 'evil' });
    let run = harness({ request });
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'path-secret',
      request,
      dependencies: run.dependencies
    });
    expect(result).toEqual({ status: 'rejected', code: 'routing_projection_unavailable' });
    expect(run.resolveBinding).not.toHaveBeenCalled();
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it('fails closed for unknown authenticated ownership without mapping or replay dispatch', async () => {
    let run = harness();
    (run.dependencies.resolveBinding as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('unknown identity')
    );
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'path-secret',
      request: run.request,
      dependencies: run.dependencies
    });
    expect(result).toEqual({ status: 'rejected', code: 'routing_projection_unavailable' });
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    ['cross-route binding swap', (value: any) => (value.routeProjection.id = 'other-route')],
    ['cross-tenant binding swap', (value: any) => (value.receiver.tenantOid = 999n)],
    ['route generation conflict', (value: any) => (value.routeGeneration = 2)],
    [
      'route digest conflict',
      (value: any) => (value.routeProjection.projectionDigest = `sha256:${'c'.repeat(64)}`)
    ],
    ['binding tombstone', (value: any) => (value.tombstonedAt = NOW)],
    ['binding expiry boundary', (value: any) => (value.expiresAt = NOW)],
    [
      'embedded route tombstone race',
      (value: any) => (value.routeProjection.tombstonedAt = NOW)
    ],
    ['receiver tombstone', (value: any) => (value.receiver.tombstonedAt = NOW)],
    ['receiver generation rebind', (value: any) => (value.hubReceiverGeneration = 8)],
    ['stale action', (value: any) => (value.triggerActionId = 'other-action')],
    ['stale spec', (value: any) => (value.triggerSpecHash = '0'.repeat(64))]
  ])('rejects %s after identity binding and before dispatch', async (_name, mutate) => {
    let stale = binding() as any;
    mutate(stale);
    let run = harness({ binding: stale });
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'path-secret',
      request: run.request,
      dependencies: run.dependencies
    });
    expect(result).toEqual({ status: 'rejected', code: 'routing_projection_stale' });
    expect(run.resolveBinding).toHaveBeenCalledTimes(1);
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it('reads the last accepted active projection without waiting on reconciliation leases', async () => {
    let leasedRoute = Object.assign(route(), {
      reconciliationLeaseOwner: 'worker-a',
      reconciliationLeaseExpiresAt: new Date(NOW.getTime() + 60_000)
    });
    let leasedBinding = Object.assign(binding(), {
      reconciliationLeaseOwner: 'worker-b',
      reconciliationLeaseExpiresAt: new Date(NOW.getTime() + 60_000)
    });
    let run = harness({ route: leasedRoute, binding: leasedBinding });
    let result = await routeSharedAppWebhook({
      routeIdentifier: 'slack-main',
      suppliedPathSecret: 'path-secret',
      request: run.request,
      dependencies: run.dependencies
    });
    expect(result.status).toBe('accepted');
    expect(run.dispatch).toHaveBeenCalledTimes(1);
  });

  it.each(['meta', 'intercom'])(
    'keeps %s shared routing disabled without an exact Hub preset',
    async vendor => {
      let unavailableRoute = { ...route(), vendor };
      let run = harness({
        route: unavailableRoute,
        pathSecrets: [
          {
            ...secret({
              purpose: 'app_route_path',
              id: 'path-current',
              version: 2,
              plaintext: 'path-secret'
            }),
            secret: {
              ...secret({
                purpose: 'app_route_path',
                id: 'path-current',
                version: 2,
                plaintext: 'path-secret'
              }).secret,
              vendor
            }
          }
        ]
      });
      let result = await routeSharedAppWebhook({
        routeIdentifier: 'slack-main',
        suppliedPathSecret: 'path-secret',
        request: run.request,
        dependencies: run.dependencies
      });
      expect(result).toEqual({ status: 'rejected', code: 'routing_projection_unavailable' });
      expect(run.calls).toEqual(['route:slack-main', 'secret:app_route_path']);
      expect(run.resolveBinding).not.toHaveBeenCalled();
    }
  );
});
