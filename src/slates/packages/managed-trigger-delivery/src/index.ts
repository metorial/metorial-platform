import { badRequestError, ServiceError } from '@lowerdeck/error';
import {
  extractGooglePubSubRoutingKeys,
  googlePubSubDeliveryConfigSchema,
  verifyGooglePubSubPush
} from '@slates/google-pubsub';
import z from 'zod';

// The push was authenticated but can never be routed; rejecting it would only make the
// sender redeliver it until it expires.
let unroutableFailures = new Set(['body_invalid', 'data_invalid', 'subscription_mismatch']);

let capabilitySchema = z
  .object({ product: z.enum(['gmail', 'forms', 'meet', 'storage']) })
  .strict();

export type TriggerInfrastructure = {
  googlePubSub: {
    projectId: string;
    topicName: string;
    subscriptionName: string;
    pushServiceAccountEmail: string;
    audience: string;
  };
};

// A saved delivery config: `id` names it, `payload` is what finishing its setup returned.
export type TriggerDeliveryConfig = { id: string; payload: unknown };

export type TriggerDelivery =
  { ok: true; routingKeys: string[] } | { ok: false; status: number };

// Cheap and independent of any saved config, so trigger groups without managed delivery
// never depend on one.
export let requestsTriggerInfrastructure = (invocation: unknown) =>
  !!invocation && typeof invocation === 'object' && 'googlePubSub' in invocation;

let fail = (message: string): never => {
  throw new ServiceError(
    badRequestError({ code: 'trigger_infrastructure_unavailable', message })
  );
};

let getProduct = (invocation: unknown) => {
  if (!requestsTriggerInfrastructure(invocation)) return undefined;
  let capability = capabilitySchema.safeParse(
    (invocation as { googlePubSub: unknown }).googlePubSub
  );
  return capability.success ? capability.data.product : undefined;
};

let parseConfig = (payload: unknown) => {
  let config = googlePubSubDeliveryConfigSchema.safeParse(payload);
  return config.success ? config.data : undefined;
};

// The first config, in the order given, that was set up for the OAuth app the connection
// uses. Undefined when the trigger group needs no managed delivery or no config matches.
export let selectTriggerDeliveryConfig = (d: {
  invocation: unknown;
  oauthClientId?: string;
  configs: TriggerDeliveryConfig[];
}): { bindingId: string; infrastructure: TriggerInfrastructure } | undefined => {
  if (!requestsTriggerInfrastructure(d.invocation)) return undefined;
  if (!getProduct(d.invocation))
    fail('This trigger requests an unsupported infrastructure capability.');
  if (!d.oauthClientId) fail('This trigger needs a connection that uses an OAuth app.');

  for (let { id, payload } of d.configs) {
    let config = parseConfig(payload);
    if (config && config.oauthClientId === d.oauthClientId)
      return { bindingId: id, infrastructure: { googlePubSub: config.googlePubSub } };
  }
  return undefined;
};

// Authenticates a push that arrived on a config's own endpoint and names the registrations
// it addresses. Each registration still verifies the request against its own saved identity.
export let authenticateTriggerDelivery = async (d: {
  invocation: unknown;
  payload: unknown;
  request: Request;
}): Promise<TriggerDelivery> => {
  let product = getProduct(d.invocation);
  let config = parseConfig(d.payload);
  if (!product || !config) return { ok: false, status: 404 };

  let verified = await verifyGooglePubSubPush({
    request: d.request,
    infrastructure: config.googlePubSub
  });
  if (!verified.ok)
    return unroutableFailures.has(verified.failure)
      ? { ok: true, routingKeys: [] }
      : { ok: false, status: verified.status };

  return { ok: true, routingKeys: extractGooglePubSubRoutingKeys(product, verified.message) };
};
