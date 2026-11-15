import { Counter, Histogram, registry } from './registry';

// Names follow the OpenTelemetry MCP semantic conventions (Development status), exposed the way
// a Prometheus exporter renders them: dots become underscores and the unit is a suffix.
export type McpOperation = {
  method: string;
  transport: 'streamable_http' | 'sse' | 'sessionless' | 'stdio' | 'unknown';
  toolName?: string;
  durationSeconds: number;
  // `tool_error` is a tool result with isError set: a JSON-RPC success that is a failure.
  errorType?: 'tool_error' | 'jsonrpc_error' | 'http_error' | 'timeout' | 'internal_error';
};

let operationDuration: Histogram | undefined;
let sessions: Counter | undefined;

let knownMethods = new Set([
  'initialize',
  'ping',
  'tools/list',
  'tools/call',
  'prompts/list',
  'prompts/get',
  'resources/list',
  'resources/read',
  'resources/templates/list',
  'resources/subscribe',
  'resources/unsubscribe',
  'completion/complete',
  'logging/setLevel',
  'notifications/initialized',
  'notifications/cancelled'
]);

export let mcpMethodLabel = (method: unknown) =>
  typeof method === 'string' && knownMethods.has(method) ? method : 'other';

export let recordMcpOperation = (op: McpOperation) => {
  if (process.env.METRICS_ENABLED !== 'true') return;

  operationDuration ??= registry.histogram({
    name: 'mcp_server_operation_duration_seconds',
    help: 'Duration of MCP requests handled by the server, by method, transport and error type.',
    labelNames: ['mcp_method_name', 'network_transport', 'gen_ai_tool_name', 'error_type'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120]
  });

  operationDuration.observe(
    {
      mcp_method_name: mcpMethodLabel(op.method),
      network_transport: op.transport,
      gen_ai_tool_name: op.method === 'tools/call' ? (op.toolName ?? 'unknown') : '',
      error_type: op.errorType ?? ''
    },
    op.durationSeconds
  );

  if (op.method === 'initialize' && !op.errorType) {
    sessions ??= registry.counter({
      name: 'mcp_server_sessions_total',
      help: 'MCP sessions initialized, by transport.',
      labelNames: ['network_transport']
    });
    sessions.inc({ network_transport: op.transport });
  }
};

export let classifyMcpResponse = (message: unknown): McpOperation['errorType'] => {
  if (!message || typeof message !== 'object') return undefined;
  let m = message as { error?: unknown; result?: { isError?: unknown } };
  if (m.error) return 'jsonrpc_error';
  if (m.result && typeof m.result === 'object' && m.result.isError === true)
    return 'tool_error';
  return undefined;
};
