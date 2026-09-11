import type {
  ProviderTool,
  SessionProvider,
  SessionProviderInstance
} from '@metorial-subspace/db';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

export interface SyntheticToolInput<P extends SessionProvider> {
  sessionProvider: P;
  idSuffix: string;
  key: string;
  name: string;
  title?: string;
  description: string;
  inputJsonSchema?: Record<string, any>;
  outputJsonSchema?: Record<string, any>;
  annotations?: ToolAnnotations;
  tags?: { readOnly?: boolean; destructive?: boolean };
  metadata?: Record<string, any>;
}

export type SyntheticProviderTool<P extends SessionProvider = SessionProvider> =
  ProviderTool & {
    key: string;
    sessionProvider: P;
    sessionProviderInstance: SessionProviderInstance;
    __metorialSynthetic: true;
  };

export let buildSyntheticTool = <P extends SessionProvider>(
  input: SyntheticToolInput<P>
): SyntheticProviderTool<P> => {
  let title = input.title ?? input.name;
  let now = new Date();

  let placeholderId = `metorial_synthetic_${input.idSuffix}`;

  let value: PrismaJson.ProviderToolValue = {
    specId: placeholderId,
    callableId: placeholderId,
    key: input.key,
    name: input.name,
    title,
    description: input.description,
    inputJsonSchema: input.inputJsonSchema ?? {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    outputJsonSchema: input.outputJsonSchema,
    constraints: [],
    instructions: [],
    mcpToolType: {
      type: 'mcp.tool',
      key: input.key,
      title,
      icons: undefined,
      annotations: input.annotations ?? { readOnlyHint: true, destructiveHint: false },
      execution: undefined,
      _meta: undefined
    },
    capabilities: {},
    tags: input.tags ?? { readOnly: true, destructive: false },
    metadata: input.metadata ?? {}
  };

  return {
    oid: 0n,
    id: `${input.sessionProvider.id}:${input.idSuffix}`,
    specId: value.specId,
    specUniqueIdentifier: value.specId,
    callableId: value.callableId,
    key: input.key,
    name: input.name,
    description: input.description,
    value,
    hash: `${placeholderId}_${input.sessionProvider.id}`,
    providerOid: 0n,
    specificationOid: 0n,
    globalOid: 0n,
    adapterOid: null,
    createdAt: now,
    updatedAt: now,
    sessionProvider: input.sessionProvider,
    sessionProviderInstance: null as any,
    __metorialSynthetic: true as const
  };
};

export let isSyntheticTool = (tool: unknown): boolean =>
  !!tool && (tool as any).__metorialSynthetic === true;
