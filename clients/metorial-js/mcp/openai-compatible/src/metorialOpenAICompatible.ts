import { createMcpSdk } from '@metorial/mcp-sdk-utils';

export interface MetorialOpenAiCompatibleFunctionTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: any;
    strict?: boolean;
  };
}

export interface MetorialOpenAiCompatibleToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MetorialOpenAiCompatibleToolResult {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

export let createOpenAICompatibleMcpSdk = (opts?: { withStrict?: boolean }) =>
  createMcpSdk()(async ({ tools }) => ({
    tools: tools.getTools().map(
      t =>
        ({
          type: 'function' as const,
          function: {
            name: t.id,
            description: t.description ?? undefined,
            parameters: t.getParametersAs('json-schema')
          }
        }) satisfies MetorialOpenAiCompatibleFunctionTool
    ) as MetorialOpenAiCompatibleFunctionTool[],

    callTools: async (
      calls: MetorialOpenAiCompatibleToolCall[]
    ): Promise<MetorialOpenAiCompatibleToolResult[]> =>
      Promise.all(
        calls.map(async call => {
          let tool = tools.getTool(call.function.name);
          if (!tool) {
            return {
              tool_call_id: call.id,
              role: 'tool' as const,
              content: `[ERROR] Tool with name "${call.function.name}" not found.`
            } satisfies MetorialOpenAiCompatibleToolResult;
          }

          let data: any = {};

          try {
            if (typeof call.function.arguments == 'string') {
              data = JSON.parse(call.function.arguments);
            } else {
              data = call.function.arguments;
            }
          } catch (e: any) {
            return {
              tool_call_id: call.id,
              role: 'tool' as const,
              content: `[ERROR] Invalid JSON in tool call arguments: ${e.message}`
            } satisfies MetorialOpenAiCompatibleToolResult;
          }

          try {
            let result = await tool.call(data);

            return {
              tool_call_id: call.id,
              role: 'tool' as const,
              content: JSON.stringify(result)
            } satisfies MetorialOpenAiCompatibleToolResult;
          } catch (e: any) {
            return {
              tool_call_id: call.id,
              role: 'tool' as const,
              content: `[ERROR] Tool call failed: ${e.message}`
            } satisfies MetorialOpenAiCompatibleToolResult;
          }
        })
      )
  }));
