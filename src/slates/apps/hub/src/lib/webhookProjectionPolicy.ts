type WebhookProjectionSecretRef = {
  source: string;
};

type WebhookProjectionRule = {
  phase: string;
  when?: {
    registrationStatuses?: readonly string[];
  };
  verify?: {
    type: string;
  };
};

export let canDeferRegistrationSecretForBootstrap = (d: {
  registrationStatus: string;
  secretRef: WebhookProjectionSecretRef;
  rules: readonly WebhookProjectionRule[];
}) =>
  d.secretRef.source === 'registration' &&
  d.rules.some(
    rule =>
      rule.phase === 'bootstrap' &&
      rule.verify?.type === 'path_secret' &&
      rule.when?.registrationStatuses?.includes(d.registrationStatus)
  );

export let fulfilledWebhookTriggerProjections = <T>(
  results: readonly PromiseSettledResult<T>[]
) => results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
