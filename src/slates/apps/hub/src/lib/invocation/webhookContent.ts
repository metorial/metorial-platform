let REDACTED = '[REDACTED]';

let webhookMethodPrefix = 'slates/trigger_group.webhook.';

let redactedFields = [
  'webhookRegistrationPayload',
  'partialWebhookRegistrationPayload',
  'userWebhookRegistrationPayload',
  'deliveryConfig'
];

let receiveUrlFields = ['url', 'webhookUrl', 'webhookSetupDocument'];

let credentialHeaders = ['authorization', 'proxy-authorization'];

type InvocationMessage = { id?: unknown; method?: unknown };

let isWebhookMethod = (method: unknown) =>
  typeof method == 'string' && method.startsWith(webhookMethodPrefix);

let redactHeaders = (headers: unknown) => {
  if (!headers || typeof headers != 'object' || Array.isArray(headers)) return headers;

  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      credentialHeaders.includes(name.toLowerCase()) ? REDACTED : value
    ])
  );
};

let redactWebhookContent = (content: unknown) => {
  if (!content || typeof content != 'object' || Array.isArray(content)) return content;

  let redacted: Record<string, unknown> = { ...content };

  for (let field of redactedFields) {
    if (field in redacted) redacted[field] = REDACTED;
  }

  for (let field of receiveUrlFields) {
    let value = redacted[field];
    if (typeof value != 'string') continue;

    redacted[field] = value.replace(/\/receive\/[^/?#\s)"'<>]+/g, `/receive/${REDACTED}`);
  }

  if ('headers' in redacted) redacted.headers = redactHeaders(redacted.headers);

  return redacted;
};

export let redactWebhookInvocationMessages = <
  Request extends InvocationMessage,
  Response extends InvocationMessage
>(d: {
  requests: Request[];
  responses: Response[];
}): { requests: Request[]; responses: Response[] } => {
  let webhookRequestIds = new Set(
    d.requests
      .filter(message => message.id != null && isWebhookMethod(message.method))
      .map(message => message.id)
  );

  let requests = d.requests.map(message =>
    isWebhookMethod(message.method) && 'params' in message
      ? ({ ...message, params: redactWebhookContent(message.params) } as Request)
      : message
  );

  let responses = d.responses.map(message =>
    message &&
    typeof message == 'object' &&
    webhookRequestIds.has(message.id) &&
    'result' in message
      ? ({ ...message, result: redactWebhookContent(message.result) } as Response)
      : message
  );

  return { requests, responses };
};
