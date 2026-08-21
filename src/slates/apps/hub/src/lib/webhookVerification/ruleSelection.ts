import type {
  SafeWebhookRejectionCode,
  SlateWebhookProviderRule,
  SlateWebhookRequestMatcher,
  SlateWebhookVerificationRule,
  WebhookWireRequest
} from '@slates/proto';

export type ExactWebhookRule = SlateWebhookVerificationRule | SlateWebhookProviderRule;

export type ResolvedWebhookSecret = Readonly<{
  id?: string;
  name: string;
  value: string;
  encoding: 'utf8' | 'hex' | 'base64' | 'base64url';
  validUntil?: Date | null;
}>;

export type WebhookVerifiedSelection =
  | { scope: 'receiver_trigger' }
  | {
      scope: 'verified_items';
      itemAdapterId: 'graph.body_value.v1';
      acceptedCandidateIds: string[];
    };

export type WebhookVerificationResult =
  | {
      status: 'accepted';
      selection: WebhookVerifiedSelection;
      presetFields?: Readonly<Record<string, string>>;
    }
  | { status: 'rejected'; code: SafeWebhookRejectionCode };

let isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let decodePointerToken = (token: string) => token.replace(/~1/g, '/').replace(/~0/g, '~');

export let resolveJsonPointer = (value: unknown, pointer: string): unknown => {
  if (!pointer.startsWith('/')) return undefined;
  return pointer
    .slice(1)
    .split('/')
    .map(decodePointerToken)
    .reduce<unknown>((current, part) => {
      if (Array.isArray(current)) {
        if (!/^(?:0|[1-9][0-9]*)$/.test(part)) return undefined;
        return current[Number(part)];
      }
      return isRecord(current) ? current[part] : undefined;
    }, value);
};

export let decodeWebhookBody = (request: WebhookWireRequest) =>
  request.body.present ? Buffer.from(request.body.base64, 'base64') : null;

export let parseWebhookJsonBody = (request: WebhookWireRequest): unknown => {
  let body = decodeWebhookBody(request);
  if (body === null) throw new Error('Webhook body is absent');
  return JSON.parse(body.toString('utf8'));
};

export let getExactHeaderValues = (request: WebhookWireRequest, headerName: string) => {
  let normalized = headerName.toLowerCase();
  return request.headers
    .filter(([name]) => name.toLowerCase() === normalized)
    .map(([, value]) => value);
};

export let requestMatchesSafeWebhookMatcher = (
  request: WebhookWireRequest,
  matcher: SlateWebhookRequestMatcher | undefined
) => {
  if (!matcher) return true;
  if (matcher.method !== undefined && matcher.method !== request.method) return false;
  if (
    matcher.hasHeader !== undefined &&
    getExactHeaderValues(request, matcher.hasHeader).length === 0
  ) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (
    matcher.hasQueryParam !== undefined &&
    !url.searchParams.has(matcher.hasQueryParam)
  ) {
    return false;
  }
  if (
    matcher.lacksQueryParam !== undefined &&
    url.searchParams.has(matcher.lacksQueryParam)
  ) {
    return false;
  }
  if (matcher.jsonBodyField) {
    let parsed: unknown;
    try {
      parsed = parseWebhookJsonBody(request);
    } catch {
      return false;
    }
    let selected = resolveJsonPointer(
      parsed,
      matcher.jsonBodyField.path.startsWith('/')
        ? matcher.jsonBodyField.path
        : `/${matcher.jsonBodyField.path.replace(/^\$\.?/, '').split('.').join('/')}`
    );
    if (selected === undefined) return false;
    if (
      matcher.jsonBodyField.equals !== undefined &&
      String(selected) !== matcher.jsonBodyField.equals
    ) {
      return false;
    }
  }
  if (matcher.formBodyField) {
    let body = decodeWebhookBody(request);
    if (body === null) return false;
    let form = new URLSearchParams(body.toString('utf8'));
    if (!form.has(matcher.formBodyField.path)) return false;
    if (
      matcher.formBodyField.equals !== undefined &&
      form.get(matcher.formBodyField.path) !== matcher.formBodyField.equals
    ) {
      return false;
    }
  }
  return true;
};

export let selectExactWebhookRule = (d: {
  rules: readonly ExactWebhookRule[];
  request: WebhookWireRequest;
  registrationStatus: string;
}):
  | { status: 'selected'; rule: ExactWebhookRule }
  | { status: 'rejected'; code: 'no_matching_rule' | 'ambiguous_rule' } => {
  let matches = d.rules.filter(
    rule =>
      rule.when.methods.includes(d.request.method) &&
      (!rule.when.registrationStatuses ||
        rule.when.registrationStatuses.includes(d.registrationStatus as never)) &&
      requestMatchesSafeWebhookMatcher(d.request, rule.when.matcher)
  );
  if (matches.length === 0) return { status: 'rejected', code: 'no_matching_rule' };
  if (matches.length !== 1) return { status: 'rejected', code: 'ambiguous_rule' };
  return { status: 'selected', rule: matches[0]! };
};
