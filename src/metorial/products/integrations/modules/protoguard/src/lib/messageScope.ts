let SKIPPED_METHODS = new Set([
  'initialize',
  'ping',
  'tools/list',
  'prompts/list',
  'resources/list',
  'resources/templates/list',
  'completion/complete',
  'logging/setLevel'
]);

let LIST_RESULT_KEYS = ['tools', 'prompts', 'resources', 'resourceTemplates'];

export interface MessageScopeInput {
  methodOrToolKey: string | null;
  hasTool: boolean;
  input?: { type: string; data?: any } | null;
  output?: { type: string; data?: any } | null;
}

let getMcpMethod = (input: MessageScopeInput['input']) =>
  input?.type == 'mcp' && typeof input.data?.method == 'string'
    ? (input.data.method as string)
    : null;

let isSkippedMethod = (method: string | null) =>
  !!method && (SKIPPED_METHODS.has(method) || method.startsWith('notifications/'));

// List results describe the provider's own catalog; tool definitions get their own scan plane, so
// rescanning every listing would only duplicate those findings.
export let isListResult = (output: MessageScopeInput['output']) => {
  let result = output?.type == 'mcp' ? output.data?.result : null;
  if (!result || typeof result != 'object' || 'content' in result) return false;

  return LIST_RESULT_KEYS.some(key => Array.isArray(result[key]));
};

export let isToolCallMessage = (d: MessageScopeInput) =>
  d.hasTool || d.input?.type == 'tool.call' || getMcpMethod(d.input) == 'tools/call';

// A tool may share its name with a control method, so a known tool always wins over the method
// name. When retention stripped the method name, the output's shape is the only signal left.
export let shouldScanMessage = (d: MessageScopeInput) => {
  if (d.hasTool) return true;
  if (isSkippedMethod(getMcpMethod(d.input))) return false;
  if (isSkippedMethod(d.methodOrToolKey)) return false;

  return !isListResult(d.output);
};
