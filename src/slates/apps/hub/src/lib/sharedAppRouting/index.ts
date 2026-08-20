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
  /** Null means the reviewed Hub protocol registry cannot authenticate this family yet. */
  preset: SlateWebhookPresetId | null;
  securityHeaders: readonly string[];
  extractAuthenticatedIdentity(request: WebhookWireRequest): SharedAppExternalIdentity | null;
}>;

export type SharedAppRouteProjection = Readonly<{
  oid: bigint;
  id: string;
  provisionedRouteId: string;
  routeIdentifier: string;
  vendor: string;
  purpose: string;
  credentialOwnerRef: string;
  generation: number;
  routeSecretId: string;
  routeSecretVersion: number;
  vendorVerificationSecretId: string;
  vendorVerificationVersion: number;
  status: string;
  projectionDigest: string;
  tombstonedAt: Date | null;
  expiresAt: Date | null;
}>;

export type SharedAppResolvedSecret = Readonly<{
  secret: {
    id: string;
    provisionedRouteId: string;
    routeGeneration: number;
    vendor: string;
    credentialOwnerRef: string;
    purpose: string;
    secretVersion: number;
    status: string;
    validFrom: Date;
    validUntil: Date | null;
  };
  plaintext: string;
}>;

export type SharedAppBindingProjection = Readonly<{
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
  routeProjection: SharedAppRouteProjection;
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
  routeProjectionId: string;
  routeGeneration: number;
  routeProjectionDigest: string;
  bindingProjectionId: string;
  bindingGeneration: number;
  bindingProjectionDigest: string;
  externalOwnershipKey: string;
  authenticatedPathSecrets: readonly Readonly<{ id: string; version: number }>[];
  authenticatedVendorSecrets: readonly Readonly<{ id: string; version: number }>[];
  bindingHash: string;
  vendorSecrets: readonly ResolvedWebhookSecret[];
}>;

export type SharedAppRoutingResult =
  | {
      status: 'accepted';
      response?: WebhookWireResponse;
      webhookRequestId?: string;
    }
  | { status: 'rejected'; code: SafeWebhookRejectionCode };

export type SharedAppRoutingDependencies = Readonly<{
  resolveRoute(routeIdentifier: string): Promise<SharedAppRouteProjection>;
  resolveRouteSecrets(d: {
    route: SharedAppRouteProjection;
    purpose: 'app_route_path' | 'vendor_verification';
  }): Promise<readonly SharedAppResolvedSecret[]>;
  buildExternalOwnershipKey(d: {
    vendor: string;
    externalAppId?: string;
    externalAccountId?: string;
    externalInstallationId?: string;
  }): string;
  resolveBinding(d: {
    routeProjectionId: string;
    authenticatedExternalOwnershipKey: string;
  }): Promise<SharedAppBindingProjection>;
  dispatch(d: {
    boundary: SharedAppAuthenticatedBoundary;
    request: WebhookWireRequest;
    suppliedPathSecret: string;
  }): Promise<
    | {
        status: 'accepted';
        response?: WebhookWireResponse;
        webhookRequestId?: string;
      }
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

let activeAt = (secret: SharedAppResolvedSecret, now: Date) =>
  (secret.secret.status === 'active' || secret.secret.status === 'retiring') &&
  secret.secret.validFrom <= now &&
  (secret.secret.status === 'active' ||
    (secret.secret.validUntil !== null && secret.secret.validUntil > now));

let exactRouteSecrets = (d: {
  route: SharedAppRouteProjection;
  purpose: 'app_route_path' | 'vendor_verification';
  secrets: readonly SharedAppResolvedSecret[];
  now: Date;
}) => {
  let expectedId =
    d.purpose === 'app_route_path'
      ? d.route.routeSecretId
      : d.route.vendorVerificationSecretId;
  let expectedVersion =
    d.purpose === 'app_route_path'
      ? d.route.routeSecretVersion
      : d.route.vendorVerificationVersion;
  let valid = d.secrets.filter(
    secret =>
      secret.secret.provisionedRouteId === d.route.provisionedRouteId &&
      secret.secret.routeGeneration === d.route.generation &&
      secret.secret.vendor === d.route.vendor &&
      secret.secret.credentialOwnerRef === d.route.credentialOwnerRef &&
      secret.secret.purpose === d.purpose &&
      Number.isInteger(secret.secret.secretVersion) &&
      secret.secret.secretVersion > 0 &&
      typeof secret.plaintext === 'string' &&
      secret.plaintext.length > 0 &&
      activeAt(secret, d.now)
  );
  let exact = valid.filter(
    secret =>
      secret.secret.id === expectedId && secret.secret.secretVersion === expectedVersion
  );
  if (
    valid.length !== d.secrets.length ||
    valid.length > 8 ||
    exact.length !== 1 ||
    new Set(valid.map(secret => secret.secret.id)).size !== valid.length ||
    new Set(valid.map(secret => secret.secret.secretVersion)).size !== valid.length ||
    valid.some(
      secret =>
        secret !== exact[0] &&
        (secret.secret.status !== 'retiring' || secret.secret.secretVersion >= expectedVersion)
    )
  ) {
    return null;
  }
  return valid;
};

let validateBinding = (d: {
  route: SharedAppRouteProjection;
  binding: SharedAppBindingProjection;
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
    binding.routeProjection.purpose === route.purpose &&
    binding.routeProjection.credentialOwnerRef === route.credentialOwnerRef &&
    binding.routeProjection.generation === route.generation &&
    binding.routeProjection.routeSecretId === route.routeSecretId &&
    binding.routeProjection.routeSecretVersion === route.routeSecretVersion &&
    binding.routeProjection.vendorVerificationSecretId === route.vendorVerificationSecretId &&
    binding.routeProjection.vendorVerificationVersion === route.vendorVerificationVersion &&
    binding.routeProjection.status === 'active' &&
    binding.routeProjection.tombstonedAt === null &&
    (binding.routeProjection.expiresAt === null ||
      binding.routeProjection.expiresAt > d.now) &&
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

/**
 * Authenticates one deliberately shared application route. The ordering is a security
 * boundary: the binding resolver is unreachable until both route credentials have passed.
 */
export let routeSharedAppWebhook = async (d: {
  routeIdentifier: string;
  suppliedPathSecret: string;
  request: WebhookWireRequest;
  dependencies: SharedAppRoutingDependencies;
}): Promise<SharedAppRoutingResult> => {
  let now = d.dependencies.now?.() ?? new Date();
  let route: SharedAppRouteProjection;
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
  ) {
    return rejection('routing_projection_stale');
  }

  let pathSecrets: readonly SharedAppResolvedSecret[];
  try {
    pathSecrets = await d.dependencies.resolveRouteSecrets({
      route,
      purpose: 'app_route_path'
    });
  } catch {
    return rejection('routing_projection_unavailable');
  }
  let validPathSecrets = exactRouteSecrets({
    route,
    purpose: 'app_route_path',
    secrets: pathSecrets,
    now
  });
  let matchedPathSecrets =
    validPathSecrets?.filter(secret =>
      verifyReceiverPathSecret({
        supplied: d.suppliedPathSecret,
        activeAndRetiring: [secret.plaintext]
      })
    ) ?? [];
  if (!validPathSecrets || matchedPathSecrets.length === 0) {
    return rejection('baseline_path_invalid');
  }

  let adapter = getSharedAppVendorAdapter(route.vendor);
  if (!adapter || adapter.preset === null) {
    return rejection('routing_projection_unavailable');
  }
  let exactAdapter = adapter as SharedAppVendorAdapter & { preset: SlateWebhookPresetId };

  let verificationSecrets: readonly SharedAppResolvedSecret[];
  try {
    verificationSecrets = await d.dependencies.resolveRouteSecrets({
      route,
      purpose: 'vendor_verification'
    });
  } catch {
    return rejection('routing_projection_unavailable');
  }
  let validVerificationSecrets = exactRouteSecrets({
    route,
    purpose: 'vendor_verification',
    secrets: verificationSecrets,
    now
  });
  if (!validVerificationSecrets) return rejection('routing_projection_stale');
  let vendorSecrets: ResolvedWebhookSecret[] = validVerificationSecrets.map(secret => ({
    name: 'vendor_verification',
    value: secret.plaintext,
    encoding: 'utf8',
    version: secret.secret.secretVersion,
    status: secret.secret.status as 'active' | 'retiring',
    validUntil: secret.secret.validUntil
  }));
  let verified = verifyWebhookPreset({
    preset: exactAdapter.preset,
    request: d.request,
    secrets: vendorSecrets,
    nowMs: now.getTime()
  });
  if (verified.status === 'rejected') return rejection(verified.code);
  let matchedVendorSecrets = validVerificationSecrets.filter(
    secret =>
      verifyWebhookPreset({
        preset: exactAdapter.preset,
        request: d.request,
        secrets: vendorSecrets.filter(
          candidate => candidate.version === secret.secret.secretVersion
        ),
        nowMs: now.getTime()
      }).status === 'accepted'
  );
  if (matchedVendorSecrets.length === 0) return rejection('credential_invalid');

  // Payload fields are tenant selectors only after the entire request has authenticated.
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

  let binding: SharedAppBindingProjection;
  try {
    binding = await d.dependencies.resolveBinding({
      routeProjectionId: route.id,
      authenticatedExternalOwnershipKey: externalOwnershipKey
    });
  } catch {
    return rejection('routing_projection_unavailable');
  }
  if (
    !validateBinding({
      route,
      binding,
      adapter: exactAdapter,
      externalOwnershipKey,
      now
    })
  ) {
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
    routeProjectionId: route.provisionedRouteId,
    routeGeneration: route.generation,
    routeProjectionDigest: route.projectionDigest,
    bindingProjectionId: binding.provisionedTenantAppId,
    bindingGeneration: binding.generation,
    bindingProjectionDigest: binding.projectionDigest,
    externalOwnershipKey,
    authenticatedPathSecrets: Object.freeze(
      matchedPathSecrets
        .map(secret =>
          Object.freeze({ id: secret.secret.id, version: secret.secret.secretVersion })
        )
        .sort((first, second) => first.version - second.version)
    ),
    authenticatedVendorSecrets: Object.freeze(
      matchedVendorSecrets
        .map(secret =>
          Object.freeze({ id: secret.secret.id, version: secret.secret.secretVersion })
        )
        .sort((first, second) => first.version - second.version)
    )
  };
  let sealedVendorSecrets = Object.freeze(
    vendorSecrets.map(secret => Object.freeze({ ...secret }))
  );
  let boundary: SharedAppAuthenticatedBoundary = Object.freeze({
    ...authority,
    bindingHash: boundaryHash(authority),
    vendorSecrets: sealedVendorSecrets
  });
  trustedBoundaries.add(boundary);
  try {
    let dispatched = await d.dependencies.dispatch({
      boundary,
      request: d.request,
      suppliedPathSecret: d.suppliedPathSecret
    });
    return dispatched;
  } catch {
    return rejection('routing_projection_stale');
  }
};

/**
 * The public route intentionally does not reveal whether its selector, either credential, or
 * authenticated external identity was the failing boundary.
 */
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
