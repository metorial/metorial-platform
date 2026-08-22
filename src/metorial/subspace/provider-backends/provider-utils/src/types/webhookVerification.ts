import {
  slatesWebhookHttp,
  slatesWebhookVerification,
  type SlateWebhookVerification
} from '@slates/proto';

export type SpecificationTriggerWebhookHttp = {
  verification: SlateWebhookVerification | null;
};

let invalidDeclaration = () =>
  new TypeError('Slate trigger has an invalid webhook verification declaration');

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let exactKeys = (value: Record<string, unknown>, expected: readonly string[]) => {
  let keys = Object.keys(value).sort();
  let sortedExpected = [...expected].sort();
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
};

/**
 * Projects the Subspace storage shape through the canonical protocol parser.
 * Webhook triggers stored before HTTP declarations were introduced have no `http` field.
 */
export let projectStoredSpecificationTriggerWebhookHttp = (
  http: unknown
): SpecificationTriggerWebhookHttp => {
  if (http === undefined) return { verification: null };
  if (!isRecord(http) || !exactKeys(http, ['verification'])) throw invalidDeclaration();
  if (http.verification === null) return { verification: null };

  let verification = slatesWebhookVerification.safeParse(http.verification);
  if (!verification.success) throw invalidDeclaration();
  return { verification: verification.data };
};

/**
 * Parses the provider-published HTTP contract and stores only receiver-route verification.
 * Shared-app ingress stays Hub-owned and is not projected into a callback trigger.
 */
export let projectSlatesSpecificationTriggerWebhookHttp = (
  http: unknown
): SpecificationTriggerWebhookHttp => {
  if (http === null) throw invalidDeclaration();

  let parsed = slatesWebhookHttp.safeParse(http === undefined ? {} : http);
  if (!parsed.success) throw invalidDeclaration();
  if (!parsed.data.ingress) return { verification: null };
  if (parsed.data.ingress.kind !== 'receiver_route') throw invalidDeclaration();

  return projectStoredSpecificationTriggerWebhookHttp({
    verification: parsed.data.ingress.verification
  });
};
