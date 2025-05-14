import { generateMcpId } from '../id';

export interface McpErrorDefinition {
  code: number;
  message: string;
  data?: Record<string, any>;
}

// JSON-RPC 2.0 error codes
//   * 32700	Parse error	Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text.
//   * 32600	Invalid Request	The JSON sent is not a valid Request object.
//   * 32601	Method not found	The method does not exist / is not available.
//   * 32602	Invalid params	Invalid method parameter(s).
//   * 32603	Internal error	Internal JSON-RPC error.
//   * 32602 - Unsupported protocol version
//   * 32000 to -32099	Server error	Reserved for implementation-defined server-errors.

let mcpErrors = {
  parse_error: () => ({
    code: -32700,
    message: 'Unable to parse request (Invalid JSON)'
  }),
  invalid_request: (data: { details?: any }) => ({
    code: -32600,
    message: 'Invalid request (Invalid JSON-RPC message)',
    ...data
  }),
  method_not_found: () => ({
    code: -32601,
    message: 'Method not found'
  }),
  invalid_params: () => ({
    code: -32602,
    message: 'Invalid params'
  }),
  internal_server_error: () => ({
    code: -32603,
    message: 'Internal server error'
  }),
  unsupported_protocol_version: (data: { supported: string[]; requested: string }) => ({
    code: -32602,
    message: 'Unsupported protocol version',
    data
  }),
  metorial_gateway_error: (data: { message: string; [key: string]: any }) => ({
    ...data,
    code: -32099,
    message: `[Metorial Gateway] ${data.message}`
  })
} satisfies Record<string, (t: any) => McpErrorDefinition>;

export class McpError<Key extends keyof typeof mcpErrors> extends Error {
  private mcpError: McpErrorDefinition;

  constructor(
    public key: Key,
    ...[params]: Parameters<(typeof mcpErrors)[Key]>[0] extends object
      ? [NonNullable<Parameters<(typeof mcpErrors)[Key]>[0]> & { message?: string }]
      : [] | [{ message?: string }]
  ) {
    let err = mcpErrors[key](params as any);

    // @ts-ignore
    if (params && params.message) err.message = params.message;

    super(err.message);

    this.mcpError = err;
  }

  toResponse() {
    return {
      jsonrpc: '2.0',
      id: generateMcpId(),
      error: this.mcpError
    };
  }
}

export let isMcpError = (err: any): err is McpError<any> => err instanceof McpError;
