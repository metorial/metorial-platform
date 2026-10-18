import { safeParse } from '../safeParse';

export let HEADER_MISMATCH_ERROR_CODE = -32020;
export let MISSING_REQUIRED_CLIENT_CAPABILITY_ERROR_CODE = -32021;
export let UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE = -32022;

let modernErrorCodes = new Set([
  HEADER_MISMATCH_ERROR_CODE,
  MISSING_REQUIRED_CLIENT_CAPABILITY_ERROR_CODE,
  UNSUPPORTED_PROTOCOL_VERSION_ERROR_CODE
]);

export interface JsonRpcErrorBody {
  jsonrpc: '2.0';
  id?: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export let parseJsonRpcError = (body: string | null | undefined): JsonRpcErrorBody | null => {
  if (!body) return null;

  let parsed = safeParse(body) as any;
  if (!parsed || typeof parsed != 'object' || Array.isArray(parsed)) return null;
  if (parsed.jsonrpc !== '2.0') return null;

  let error = parsed.error;
  if (!error || typeof error != 'object') return null;
  if (typeof error.code != 'number' || !Number.isInteger(error.code)) return null;

  return {
    jsonrpc: '2.0',
    id: parsed.id,
    error: {
      code: error.code,
      message: typeof error.message == 'string' ? error.message : '',
      data: error.data
    }
  };
};

export let parseModernMcpError = (body: string | null | undefined) => {
  let error = parseJsonRpcError(body);
  if (!error || !modernErrorCodes.has(error.error.code)) return null;

  return error;
};
