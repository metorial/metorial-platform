import { createHash } from 'node:crypto';
import {
  computeWebhookActionSpecHashV1,
  type SafeWebhookRejectionCode,
  type SlateWebhookPresetId,
  type WebhookWireRequest,
  type WebhookWireResponse
} from '@slates/proto';
import {
  verifyReceiverPathSecret,
  verifyWebhookPreset,
  type ResolvedWebhookSecret
} from '../webhookVerification';
import { hubspotSharedAppAdapter } from './hubspot';
import { intercomSharedAppAdapter } from './intercom';
import { metaSharedAppAdapter } from './meta';
import { slackSharedAppAdapter } from './slack';
import { zoomSharedAppAdapter } from './zoom';

export type SharedAppExternalIdentity = Readonly<{
  externalAppId?: string;
  externalAccountId?: string;
  externalInstallationId?: string;
}>;

export type SharedAppVendorAdapter = Readonly<{
  family: string;
  preset: SlateWebhookPresetId | null;
  securityHeaders: readonly string[];
  extractAuthenticatedIdentity(request: WebhookWireRequest): SharedAppExternalIdentity | null;
}>;

export type SharedAppRouteIdentity = Readonly<{
  oid: bigint;
  id: string;
  provisionedRouteId: string;
  routeIdentifier: string;
  vendor: string;
  purpose: string;
  oauthCredentialsOid: bigint | null;
  authConfigOid: bigint | null;
  generation: number;
  status: string;
  projectionDigest: string;
  tombstonedAt: Date | null;
  expiresAt: Date | null;
}>;

export type SharedAppResolvedSecret = Readonly<{
  id: string;
  purpose: 'app_route_path' | 'vendor_verification';
  plaintext: string;
  validUntil?: Date | null;
}>;

export type SharedAppBindingIdentity = Readonly<{
  routeProjectionOid: bigint;
  tenantOid: bigint;
  receiverOid: bigint;
  receiverTriggerOid: bigint;
  id: string;
  provisionedTenantAppId: string;
  routeIdentifier: string;
  routeGeneration: number;
  hubReceiverGeneration: number;
  callbackInstanceId: string;
  triggerActionId: string;
  triggerSpecHash: string;
  vendor: string;
  purpose: string;
  externalOwnershipKey: string | null;
  generation: number;
  status: string;
  projectionDigest: string;
  tombstonedAt: Date | null;
  expiresAt: Date | null;
  routeProjection: SharedAppRouteIdentity;
  tenant: { oid: bigint; id: string };
  receiver: {
    oid: bigint;
    tenantOid: bigint;
    id: string;
    status: string;
    callbackInstanceId: string | null;
    tombstonedAt: Date | null;
  };
  receiverTrigger: {
    oid: bigint;
    receiverOid: bigint;
    id: string;
    registrationGeneration: number;
    verificationMechanism: string;
    verificationSpecHash: string | null;
    tombstonedAt: Date | null;
    action: { key: string; spec: unknown };
  };
}>;

export type SharedAppAuthenticatedBoundary = Readonly<{
  kind: 'shared_provisioned_app';
  authenticatedAt: Date;
  tenantId: string;
  receiverId: string;
  receiverTriggerId: string;
  receiverGeneration: number;
  triggerActionId: string;
  specHash: string;
  vendor: string;
  preset: SlateWebhookPresetId;
  routeIdentityId: string;
  routeGeneration: number;
  routeDigest: string;
  bindingIdentityId: string;
  bindingGeneration: number;
  bindingDigest: string;
  externalOwnershipKey: string;
  authenticatedPathSecretIds: readonly string[];
  authenticatedVendorSecretIds: readonly string[];
  bindingHash: string;
  vendorSecrets: readonly ResolvedWebhookSecret[];
}>;

export type SharedAppRoutingResult =
  | { status: 'accepted'; response?: WebhookWireResponse; webhookRequestId?: string }
  | { status: 'rejected'; code: SafeWebhookRejectionCode };

export type SharedAppRoutingDependencies = Readonly<{
  resolveRoute(routeIdentifier: string): Promise<SharedAppRouteIdentity>;
  resolveRouteSecrets(d: {
    route: SharedAppRouteIdentity;
    purpose: 'app_route_path' | 'vendor_verification';
  }): Promise<readonly SharedAppResolvedSecret[]>;
  buildExternalOwnershipKey(d: {
    vendor: string;
    externalAppId?: string;
    externalAccountId?: string;
    externalInstallationId?: string;
  }): string;
  resolveBinding(d: {
    routeIdentityId: string;
    authenticatedExternalOwnershipKey: string;
  }): Promise<SharedAppBindingIdentity>;
  dispatch(d: {
    boundary: SharedAppAuthenticatedBoundary;
    request: WebhookWireRequest;
    suppliedPathSecret: string;
  }): Promise<
    | { status: 'accepted'; response?: WebhookWireResponse; webhookRequestId?: string }
    | { status: 'rejected'; code: SafeWebhookRejectionCode }
  >;
  now?: () => Date;
}>;

let adapters = new Map(
  [
    metaSharedAppAdapter,
    zoomSharedAppAdapter,
    hubspotSharedAppAdapter,
    intercomSharedAppAdapter,
    slackSharedAppAdapter
  ].map(adapter => [adapter.family, adapter] as const)
);

export let getSharedAppVendorAdapter = (vendor: string) =>
  adapters.get(vendor.trim().toLowerCase()) ?? null;

let trustedBoundaries = new WeakSet<object>();

export let isTrustedSharedAppBoundary = (boundary: SharedAppAuthenticatedBoundary) =>
  trustedBoundaries.has(boundary);

let exactRouteSecret = (d: {
  purpose: 'app_route_path' | 'vendor_verification';
  secrets: readonly SharedAppResolvedSecret[];
  now: Date;
}) => {
  let active = d.secrets.filter(
    secret =>
      secret.purpose === d.purpose &&
      secret.id.length > 0 &&
      secret.plaintext.length > 0 &&
      (secret.validUntil === undefined ||
        secret.validUntil === null ||
        secret.validUntil > d.now)
  );
  if (
    active.length !== d.secrets.length ||
    active.length !== 1 ||
    new Set(active.map(secret => secret.id)).size !== active.length
  ) return null;
  return active[0]!;
};

let validateBinding = (d: {
  route: SharedAppRouteIdentity;
  binding: SharedAppBindingIdentity;
  adapter: SharedAppVendorAdapter & { preset: SlateWebhookPresetId };
  externalOwnershipKey: string;
  now: Date;
}) => {
  let { route, binding } = d;
  let actionSpec = binding.receiverTrigger.action.spec;
  if (!actionSpec || typeof actionSpec !== 'object' || Array.isArray(actionSpec)) return false;
  let contract = actionSpec as Record<string, any>;
  let ingress = contract.invocation?.http?.ingress;
  let rules = ingress?.verification?.rules;
  let specHash = (() => {
    try {
      return computeWebhookActionSpecHashV1(contract as never);
    } catch {
      return null;
    }
  })();
  return (
    route.status === 'active' &&
    route.tombstonedAt === null &&
    (route.expiresAt === null || route.expiresAt > d.now) &&
    /^sha256:[a-f0-9]{64}$/.test(route.projectionDigest) &&
    binding.routeProjection.id === route.id &&
    binding.routeProjectionOid === route.oid &&
    binding.routeProjection.provisionedRouteId === route.provisionedRouteId &&
    binding.routeProjection.routeIdentifier === route.routeIdentifier &&
    binding.routeProjection.vendor === route.vendor &&
    binding.routeProjection.generation === route.generation &&
    binding.routeProjection.projectionDigest === route.projectionDigest &&
    binding.routeIdentifier === route.routeIdentifier &&
    binding.routeGeneration === route.generation &&
    binding.vendor === route.vendor &&
    binding.purpose === 'shared_provisioned_app' &&
    binding.status === 'active' &&
    binding.tombstonedAt === null &&
    (binding.expiresAt === null || binding.expiresAt > d.now) &&
    /^sha256:[a-f0-9]{64}$/.test(binding.projectionDigest) &&
    Number.isInteger(binding.generation) &&
    binding.generation > 0 &&
    binding.externalOwnershipKey === d.externalOwnershipKey &&
    binding.tenantOid === binding.tenant.oid &&
    binding.receiverOid === binding.receiver.oid &&
    binding.receiver.tenantOid === binding.tenantOid &&
    binding.receiverTriggerOid === binding.receiverTrigger.oid &&
    binding.receiverTrigger.receiverOid === binding.receiverOid &&
    binding.receiver.status === 'active' &&
    binding.receiver.tombstonedAt === null &&
    binding.receiver.callbackInstanceId === binding.callbackInstanceId &&
    binding.receiverTrigger.tombstonedAt === null &&
    binding.receiverTrigger.registrationGeneration === binding.hubReceiverGeneration &&
    binding.receiverTrigger.action.key === binding.triggerActionId &&
    binding.receiverTrigger.verificationSpecHash === binding.triggerSpecHash &&
    binding.receiverTrigger.verificationMechanism === 'hub' &&
    contract.specHash === binding.triggerSpecHash &&
    specHash === binding.triggerSpecHash &&
    ingress?.kind === 'shared_provisioned_app' &&
    ingress?.routeFamily === d.adapter.family &&
    ingress?.verification?.mechanism === 'hub' &&
    Array.isArray(rules) &&
    rules.length > 0 &&
    rules.every(
      (rule: any) => rule?.verify?.type === 'preset' && rule.verify.preset === d.adapter.preset
    )
  );
};

let boundaryHash = (
  value: Omit<SharedAppAuthenticatedBoundary, 'bindingHash' | 'vendorSecrets'>
) =>
  createHash('sha256')
    .update('metorial.shared-app-authenticated-boundary\0v1\0', 'utf8')
    .update(JSON.stringify(value), 'utf8')
    .digest('hex');

let rejection = (code: SafeWebhookRejectionCode): SharedAppRoutingResult => ({
  status: 'rejected',
  code
});

export let routeSharedAppWebhook = async (d: {
  routeIdentifier: string;
  suppliedPathSecret: string;
  request: WebhookWireRequest;
  dependencies: SharedAppRoutingDependencies;
}): Promise<SharedAppRoutingResult> => {
  let now = d.dependencies.now?.() ?? new Date();
  let route: SharedAppRouteIdentity;
  try {
    route = await d.dependencies.resolveRoute(d.routeIdentifier);
  } catch {
    return rejection('routing_projection_unavailable');
  }
  if (
    route.routeIdentifier !== d.routeIdentifier ||
    route.purpose !== 'shared_provisioned_app' ||
    route.status !== 'active' ||
    route.tombstonedAt !== null ||
    (route.expiresAt !== null && route.expiresAt <= now) ||
    !/^sha256:[a-f0-9]{64}$/.test(route.projectionDigest)
  ) return rejection('routing_projection_stale');

  let pathSecret: SharedAppResolvedSecret;
  try {
    let resolved = exactRouteSecret({
      purpose: 'app_route_path',
      secrets: await d.dependencies.resolveRouteSecrets({
        route,
        purpose: 'app_route_path'
      }),
      now
    });
    if (!resolved) return rejection('routing_projection_stale');
    pathSecret = resolved;
  } catch {
    return rejection('routing_projection_unavailable');
  }
  if (
    !verifyReceiverPathSecret({
      supplied: d.suppliedPathSecret,
      activeAndRetiring: [pathSecret.plaintext]
    })
  ) return rejection('baseline_path_invalid');

  let adapter = getSharedAppVendorAdapter(route.vendor);
  if (!adapter || adapter.preset === null) return rejection('routing_projection_unavailable');
  let exactAdapter = adapter as SharedAppVendorAdapter & { preset: SlateWebhookPresetId };

  let vendorSecret: SharedAppResolvedSecret;
  try {
    let resolved = exactRouteSecret({
      purpose: 'vendor_verification',
      secrets: await d.dependencies.resolveRouteSecrets({
        route,
        purpose: 'vendor_verification'
      }),
      now
    });
    if (!resolved) return rejection('routing_projection_stale');
    vendorSecret = resolved;
  } catch {
    return rejection('routing_projection_unavailable');
  }

  let vendorSecrets: ResolvedWebhookSecret[] = [{
    id: vendorSecret.id,
    name: 'vendor_verification',
    value: vendorSecret.plaintext,
    encoding: 'utf8',
    validUntil: vendorSecret.validUntil
  }];
  let verified = verifyWebhookPreset({
    preset: exactAdapter.preset,
    request: d.request,
    secrets: vendorSecrets,
    nowMs: now.getTime()
  });
  if (verified.status === 'rejected') return rejection(verified.code);

  let identity = exactAdapter.extractAuthenticatedIdentity(d.request);
  if (!identity) return rejection('routing_projection_unavailable');
  let externalOwnershipKey: string;
  try {
    externalOwnershipKey = d.dependencies.buildExternalOwnershipKey({
      vendor: route.vendor,
      ...identity
    });
  } catch {
    return rejection('routing_projection_unavailable');
  }

  let binding: SharedAppBindingIdentity;
  try {
    binding = await d.dependencies.resolveBinding({
      routeIdentityId: route.id,
      authenticatedExternalOwnershipKey: externalOwnershipKey
    });
  } catch {
    return rejection('routing_projection_unavailable');
  }
  if (!validateBinding({ route, binding, adapter: exactAdapter, externalOwnershipKey, now })) {
    return rejection('routing_projection_stale');
  }

  let authority = {
    kind: 'shared_provisioned_app' as const,
    authenticatedAt: now,
    tenantId: binding.tenant.id,
    receiverId: binding.receiver.id,
    receiverTriggerId: binding.receiverTrigger.id,
    receiverGeneration: binding.hubReceiverGeneration,
    triggerActionId: binding.triggerActionId,
    specHash: binding.triggerSpecHash,
    vendor: route.vendor,
    preset: exactAdapter.preset,
    routeIdentityId: route.provisionedRouteId,
    routeGeneration: route.generation,
    routeDigest: route.projectionDigest,
    bindingIdentityId: binding.provisionedTenantAppId,
    bindingGeneration: binding.generation,
    bindingDigest: binding.projectionDigest,
    externalOwnershipKey,
    authenticatedPathSecretIds: Object.freeze([pathSecret.id]),
    authenticatedVendorSecretIds: Object.freeze([vendorSecret.id])
  };
  let boundary: SharedAppAuthenticatedBoundary = Object.freeze({
    ...authority,
    bindingHash: boundaryHash(authority),
    vendorSecrets: Object.freeze(vendorSecrets.map(secret => Object.freeze({ ...secret })))
  });
  trustedBoundaries.add(boundary);
  try {
    return await d.dependencies.dispatch({
      boundary,
      request: d.request,
      suppliedPathSecret: d.suppliedPathSecret
    });
  } catch {
    return rejection('routing_projection_stale');
  }
};

export let normalizeSharedAppPublicRejection = (_result: {
  status: 'rejected';
  code: SafeWebhookRejectionCode;
}) => ({ status: 404 as const, body: 'Not Found' as const });

export {
  hubspotSharedAppAdapter,
  intercomSharedAppAdapter,
  metaSharedAppAdapter,
  slackSharedAppAdapter,
  zoomSharedAppAdapter
};
