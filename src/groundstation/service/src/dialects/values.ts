export type TokenUsage = {
  input_uncached?: number;
  cache_read?: number;
  cache_write?: number;
  cache_write_5m?: number;
  cache_write_1h?: number;
  output?: number;
  reasoning?: number;
  tool_input?: number;
  total_reported?: number;
  unaccounted?: number;
  provenance: 'exact' | 'derived' | 'partial' | 'aggregate';
};

export type Cost = {
  amount: string;
  unit: 'usd' | 'credits' | 'nano_aiu' | 'premium_request_multiplier' | 'cents';
  basis: 'client_estimate' | 'server_estimate' | 'billed' | 'quota_units';
  repeats_parent?: boolean;
  arrives_late?: boolean;
};

export type ErrorClass =
  | 'auth'
  | 'rate_limit'
  | 'overloaded'
  | 'invalid_request'
  | 'context_length'
  | 'network'
  | 'timeout'
  | 'server'
  | 'tool'
  | 'permission'
  | 'internal'
  | 'unknown';

export type ErrorInfo = {
  class: ErrorClass;
  native_type?: string;
  status_code?: number;
  retryable?: boolean;
};

export type Outcome = 'ok' | 'error' | 'cancelled' | 'timeout' | 'refused' | 'blocked';

export type Decision = {
  value: 'allow' | 'deny' | 'abort' | 'ask';
  source:
    | 'config'
    | 'policy'
    | 'hook'
    | 'user'
    | 'classifier'
    | 'reviewer'
    | 'sandbox'
    | 'default'
    | 'unknown';
  scope: 'once' | 'session' | 'persistent' | 'none' | 'unknown';
  automatic: boolean;
};

export let own = <T>(table: Record<string, T>, key: string | undefined): T | undefined =>
  key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;

let maxNativeLength = 64;

export type UsageInput = {
  inputUncached?: number;
  inputIncludingCache?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cacheWrite5m?: number;
  cacheWrite1h?: number;
  output?: number;
  outputIncludingReasoning?: number;
  reasoning?: number;
  toolInput?: number;
  totalReported?: number;
  provenance?: TokenUsage['provenance'];
};

export type UsageResult = {
  usage?: TokenUsage;
  derived: string[];
  warnings: string[];
};

export let buildUsage = (input: UsageInput): UsageResult => {
  let derived: string[] = [];
  let warnings: string[] = [];
  let usage: TokenUsage = { provenance: input.provenance ?? 'exact' };

  let inputUncached = input.inputUncached;

  if (inputUncached === undefined && input.inputIncludingCache !== undefined) {
    let remainder = input.inputIncludingCache - (input.cacheRead ?? 0);

    if (remainder >= 0) {
      inputUncached = remainder;
      derived.push('usage.input_uncached');
    } else {
      warnings.push('usage_negative:input_uncached');
    }
  }

  let output = input.output;

  if (output === undefined && input.outputIncludingReasoning !== undefined) {
    let remainder = input.outputIncludingReasoning - (input.reasoning ?? 0);

    if (remainder >= 0) {
      output = remainder;
      derived.push('usage.output');
    } else {
      warnings.push('usage_negative:output');
    }
  }

  let components: [keyof TokenUsage, number | undefined][] = [
    ['input_uncached', inputUncached],
    ['cache_read', input.cacheRead],
    ['cache_write', input.cacheWrite],
    ['cache_write_5m', input.cacheWrite5m],
    ['cache_write_1h', input.cacheWrite1h],
    ['output', output],
    ['reasoning', input.reasoning],
    ['tool_input', input.toolInput]
  ];

  let present = 0;
  let sum = 0;

  for (let [key, value] of components) {
    if (value === undefined || value < 0) continue;

    (usage as Record<string, unknown>)[key] = value;
    present++;

    if (key != 'cache_write_5m' && key != 'cache_write_1h' && key != 'reasoning') {
      sum += value;
    }
  }

  if (input.totalReported !== undefined && input.totalReported >= 0) {
    usage.total_reported = input.totalReported;

    let missing = input.totalReported - sum - (input.reasoning ?? 0);
    if (missing > 0 && present > 0) usage.unaccounted = missing;
  }

  if (present == 0 && usage.total_reported === undefined) {
    return { derived, warnings };
  }

  if (derived.length > 0 && usage.provenance == 'exact') usage.provenance = 'derived';
  if (present == 0 && usage.provenance == 'exact') usage.provenance = 'partial';

  return { usage, derived, warnings };
};

let formatDecimal = (value: number) => {
  if (Number.isInteger(value)) return String(value);

  let text = value.toFixed(10);

  return text.replace(/0+$/, '').replace(/\.$/, '');
};

export let microsToDecimal = (micros: number): string => {
  let negative = micros < 0;
  let whole = BigInt(Math.abs(Math.trunc(micros)));

  let integer = whole / 1_000_000n;
  let fraction = (whole % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');

  let text = fraction ? `${integer}.${fraction}` : String(integer);

  return negative ? `-${text}` : text;
};

export let usdCost = (
  input: { micros?: number; usd?: number },
  basis: Cost['basis'],
  extra: Partial<Pick<Cost, 'repeats_parent' | 'arrives_late'>> = {}
): Cost | undefined => {
  let amount: string | undefined;

  if (input.micros !== undefined && Number.isSafeInteger(input.micros) && input.micros >= 0) {
    amount = microsToDecimal(input.micros);
  } else if (input.usd !== undefined && Number.isFinite(input.usd) && input.usd >= 0) {
    amount = formatDecimal(input.usd);
  }

  return amount === undefined ? undefined : { amount, unit: 'usd', basis, ...extra };
};

export let decimalCost = (
  amount: string | undefined,
  basis: Cost['basis'],
  extra: Partial<Pick<Cost, 'repeats_parent' | 'arrives_late'>> = {}
): Cost | undefined =>
  amount !== undefined && /^\d{1,18}(\.\d{1,18})?$/.test(amount)
    ? { amount, unit: 'usd', basis, ...extra }
    : undefined;

export let nativeLabel = (value: unknown): string | undefined => {
  if (typeof value != 'string') return undefined;

  let trimmed = value.trim();
  if (!trimmed) return undefined;

  return trimmed.length > maxNativeLength ? trimmed.slice(0, maxNativeLength) : trimmed;
};

export let errorFromStatus = (
  status: number | undefined,
  nativeType?: string,
  fallback: ErrorClass = 'unknown'
): ErrorInfo => {
  let native = nativeLabel(nativeType);
  let lowered = native?.toLowerCase() ?? '';
  let errorClass: ErrorClass = fallback;

  if (lowered.includes('context') && lowered.includes('length')) errorClass = 'context_length';
  else if (lowered.includes('rate')) errorClass = 'rate_limit';
  else if (lowered.includes('overload')) errorClass = 'overloaded';
  else if (lowered.includes('timeout') || lowered.includes('timed_out'))
    errorClass = 'timeout';
  else if (lowered.includes('auth')) errorClass = 'auth';
  else if (status === 401 || status === 403) errorClass = 'auth';
  else if (status === 429) errorClass = 'rate_limit';
  else if (status === 529 || status === 503) errorClass = 'overloaded';
  else if (status === 408 || status === 504) errorClass = 'timeout';
  else if (status === 413 || status === 400 || status === 404 || status === 422) {
    errorClass = 'invalid_request';
  } else if (status !== undefined && status >= 500) errorClass = 'server';
  else if (status === 0) errorClass = 'network';

  return {
    class: errorClass,
    ...(native ? { native_type: native } : {}),
    ...(status !== undefined && Number.isInteger(status) ? { status_code: status } : {}),
    ...(errorClass == 'rate_limit' ||
    errorClass == 'overloaded' ||
    errorClass == 'timeout' ||
    errorClass == 'server' ||
    errorClass == 'network'
      ? { retryable: true }
      : {})
  };
};

let efforts = new Set(['low', 'medium', 'high', 'max', 'none']);

export let normalizeEffort = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined;

  let lowered = raw.trim().toLowerCase();
  if (efforts.has(lowered)) return lowered;

  let slug = lowered.replace(/[^a-z0-9_-]/g, '_').slice(0, 32);

  return slug ? `other:${slug}` : undefined;
};

export let normalizeSpeed = (raw: string | undefined): 'standard' | 'fast' | undefined => {
  let lowered = raw?.trim().toLowerCase();

  if (lowered == 'standard' || lowered == 'fast') return lowered;

  return undefined;
};

let knownProviders = new Set([
  'anthropic',
  'openai',
  'google',
  'vertex',
  'bedrock',
  'azure',
  'github',
  'cursor',
  'kiro',
  'gateway'
]);

let providerAliases: Record<string, string> = {
  'aws.bedrock': 'bedrock',
  'gcp.vertex_ai': 'vertex',
  'gcp.gemini': 'google',
  'gcp.gen_ai': 'google',
  'azure.ai.openai': 'azure',
  'azure.ai.inference': 'azure',
  foundry: 'azure',
  vertex_ai: 'vertex',
  'google.vertex': 'vertex'
};

export let normalizeProvider = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined;

  let lowered = raw.trim().toLowerCase();
  if (!lowered) return undefined;

  if (knownProviders.has(lowered)) return lowered;
  let alias = own(providerAliases, lowered);
  if (alias) return alias;

  let slug = lowered.replace(/[^a-z0-9_-]/g, '_').slice(0, 32);

  return slug ? `other:${slug}` : undefined;
};
