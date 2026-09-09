import { getSentry } from '@lowerdeck/sentry';

let Sentry = getSentry();

let MAX_LOGS = 50;

export type SlateInvocationServerErrorReason =
  | 'function_bay_error'
  | 'jsonrpc_server_error'
  | 'invocation_exception';

let numericJsonRpcServerErrorCodes = new Set([-32700, -32600, -32603]);
let stringJsonRpcServerErrorCodes = new Set(['internal_error', 'internal_server_error']);

export let isJsonRpcServerError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  let code = (error as { code?: unknown }).code;
  let message = (error as { message?: unknown }).message;

  if (typeof message === 'string' && /internal server error/i.test(message)) return true;

  if (typeof code === 'string') {
    if (stringJsonRpcServerErrorCodes.has(code)) return true;
    if (/^-?\d+$/.test(code)) return isJsonRpcServerErrorCode(Number(code));
    return false;
  }

  if (typeof code === 'number') return isJsonRpcServerErrorCode(code);

  return false;
};

let isJsonRpcServerErrorCode = (code: number) => {
  if (numericJsonRpcServerErrorCodes.has(code)) return true;
  // JSON-RPC reserved server error range
  return code <= -32000 && code >= -32099;
};

let serializeErrorForLog = (error: unknown): unknown => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
};

export let reportSlateInvocationServerError = (d: {
  reason: SlateInvocationServerErrorReason;
  invocationId: string;
  invocationOid?: bigint;
  slateVersionId: string;
  tenantIdentifier?: string;
  providerInvocationId?: string;
  error?: unknown;
  logs?: { timestamp: number; message: string }[];
  methods?: string[];
  suppressSentry?: boolean;
}) => {
  let extra = {
    reason: d.reason,
    invocationId: d.invocationId,
    invocationOid: d.invocationOid !== undefined ? String(d.invocationOid) : undefined,
    slateVersionId: d.slateVersionId,
    tenantIdentifier: d.tenantIdentifier,
    providerInvocationId: d.providerInvocationId,
    methods: d.methods,
    error: serializeErrorForLog(d.error),
    logs: d.logs?.slice(-MAX_LOGS)
  };

  console.error('[SlateInvocation] Server error during invocation', extra);

  if (d.suppressSentry) return;

  if (d.error instanceof Error) {
    Sentry.captureException(d.error, {
      fingerprint: ['slate-invocation-server-error', d.reason, d.slateVersionId],
      extra
    });
    return;
  }

  Sentry.captureMessage(`Slate invocation server error (${d.reason})`, {
    level: 'error',
    fingerprint: ['slate-invocation-server-error', d.reason, d.slateVersionId],
    extra
  });
};
