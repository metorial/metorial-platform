import type { Session } from '@metorial-subspace/db';
import { sessionAsToolOwner } from './connectionStatusTool';
import { buildSyntheticTool } from './syntheticTool';

// Request tools override same-key provider tools, so their keys must use this prefix.
export let METORIAL_TOOL_KEY_PREFIX = 'metorial_';

// Never persisted: hosted sessions are shared across callers.
export interface RequestScopedTool {
  key: string;
  name: string;
  description: string;
  inputJsonSchema: Record<string, any>;
  outputJsonSchema?: Record<string, any>;
  readOnly?: boolean;
  destructive?: boolean;
}

export interface RequestScopedTools {
  tools: RequestScopedTool[];
  call: (key: string, input: unknown) => Promise<Record<string, any>>;
  redactForLog?: (d: { key: string; input: unknown; output?: Record<string, any> }) => {
    input: unknown;
    output?: Record<string, any>;
  };
}

export type RequestScopedToolsResolver = () => Promise<RequestScopedTools | null>;

export let buildRequestScopedTool = (session: Session, tool: RequestScopedTool) => {
  let readOnly = tool.readOnly ?? false;
  let destructive = tool.destructive ?? !readOnly;

  return buildSyntheticTool({
    sessionProvider: sessionAsToolOwner(session),
    idSuffix: `request_${tool.key}`,
    key: tool.key,
    name: tool.name,
    description: tool.description,
    inputJsonSchema: tool.inputJsonSchema,
    outputJsonSchema: tool.outputJsonSchema,
    annotations: { readOnlyHint: readOnly, destructiveHint: destructive },
    tags: { readOnly, destructive },
    metadata: { metorialRequestTool: true }
  });
};
