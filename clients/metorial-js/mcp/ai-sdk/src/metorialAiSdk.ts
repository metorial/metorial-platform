import { createMcpSdk } from '@metorial/mcp-sdk-utils';
import { jsonSchema, Tool, tool } from 'ai';

export let metorialAiSdk = createMcpSdk()(async ({ tools }) => ({
  tools: Object.fromEntries([
    ...tools.getTools().map(t => [
      t.id,
      tool({
        description: t.description ?? undefined,
        parameters: jsonSchema(t.getParametersAs('json-schema') as any),
        execute: async (params: any) => t.call(params)
      })
    ])
  ]) as Record<string, Tool>
}));
