import { isClaudeCodeBuiltInAgent } from '@mtsrc/agent-tracking-spec';
import type { OtlpAttributes } from '@mtsrc/agent-tracking-otlp';
import { claudeCodeCustomName, claudeCodePlaceholder } from '../otlp/claudeCode';
import { rewrite } from '../otlp/policy';
import { isMcpTool, redactedMcpTool } from '../tools';
import type { FieldSource } from '../fields';
import type { OtlpPolicy } from '../types';

let hookDetails = new Set([
  'tool_input',
  'toolInput',
  'tool_response',
  'toolResponse',
  'mcp_server'
]);

let hookToolNames = new Set(['tool_name', 'toolName']);

let hookToolMessages = new Set(['error', 'reason']);

let hookWithoutToolDetails = (payload: FieldSource): FieldSource => {
  let attributes = payload as OtlpAttributes;
  let toolName = payload['tool_name'] ?? payload['toolName'];
  let tool = typeof toolName == 'string';
  let mcp = isMcpTool({ name: toolName, server: payload['mcp_server'] });

  return rewrite(attributes, (key, value) => {
    if (hookDetails.has(key) || (tool && hookToolMessages.has(key))) return undefined;
    if (hookToolNames.has(key)) return mcp ? redactedMcpTool : value;
    if (key == 'command_name') return claudeCodePlaceholder(attributes, key, value);

    if (key == 'agent_type' || key == 'agentType') {
      return isClaudeCodeBuiltInAgent({ agentType: value }) ? value : claudeCodeCustomName;
    }

    return value;
  });
};

export let withHookPolicy = (payload: FieldSource, policy: OtlpPolicy): FieldSource =>
  policy.toolDetails ? payload : hookWithoutToolDetails(payload);
