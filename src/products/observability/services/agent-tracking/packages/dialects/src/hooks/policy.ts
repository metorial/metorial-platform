import { fullIngestPolicy } from '@mtsrc/agent-tracking-spec';
import type { OtlpAttributes } from '@mtsrc/agent-tracking-otlp';
import { claudeCodePlaceholder } from '../otlp/claudeCode';
import { isCodexMcpServer, isCodexMcpToolName } from '../otlp/codex';
import { redactedMcpTool, rewrite } from '../otlp/policy';
import { isFieldSource, type FieldSource } from '../fields';
import type { HookContext, OtlpPolicy } from '../types';

let hookDetails = new Set([
  'tool_input',
  'toolInput',
  'tool_response',
  'toolResponse',
  'mcp_server'
]);

let hookToolNames = new Set(['tool_name', 'toolName']);

let hookToolMessages = new Set(['error', 'reason']);

let builtInAgentTypes = new Set(['general-purpose', 'Explore']);

export let hookPolicyOf = (context: HookContext): OtlpPolicy =>
  context.policy ?? fullIngestPolicy;

export let isHookMcpServer = (value: unknown) =>
  isCodexMcpServer(value) || (isFieldSource(value) && Object.keys(value).length > 0);

export let hookWithoutToolDetails = (payload: FieldSource): FieldSource => {
  let attributes = payload as OtlpAttributes;
  let toolName = payload['tool_name'] ?? payload['toolName'];
  let tool = typeof toolName == 'string';
  let mcp = isHookMcpServer(payload['mcp_server']) || isCodexMcpToolName(toolName);

  return rewrite(attributes, (key, value) => {
    if (hookDetails.has(key) || (tool && hookToolMessages.has(key))) return undefined;
    if (hookToolNames.has(key)) return mcp ? redactedMcpTool : value;
    if (key == 'command_name') return claudeCodePlaceholder(attributes, key, value);

    if (key == 'agent_type' || key == 'agentType') {
      let builtIn = typeof value == 'string' && builtInAgentTypes.has(value);
      return claudeCodePlaceholder({ is_built_in: builtIn }, 'agent_type', value);
    }

    return value;
  });
};

export let withHookPolicy = (payload: FieldSource, policy: OtlpPolicy): FieldSource =>
  policy.toolDetails ? payload : hookWithoutToolDetails(payload);
