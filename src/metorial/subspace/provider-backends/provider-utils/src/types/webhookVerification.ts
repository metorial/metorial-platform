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
 * Projects the normalized Metorial storage shape through the canonical protocol parser.
 * Missing `http` is the only legacy storage representation accepted implicitly.
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
 * Strictly parses the complete provider-published HTTP contract, then projects only its
 * receiver-route verification declaration. A valid legacy `slatesWebhookHttp` object with
 * no ingress is the reviewed undeclared representation and maps to explicit null.
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
