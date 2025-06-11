import { createMcpSdk } from '@metorial/mcp-sdk-utils';
import { Tool, ToolCall, ToolMessage } from '@mistralai/mistralai/models/components';

export let metorialMistral = createMcpSdk()(async ({ tools }) => ({
  tools: tools.getTools().map(
    t =>
      ({
        type: 'function' as const,
        function: {
          name: t.id,
          description: t.description ?? undefined,
          parameters: t.getParametersAs('json-schema') as any,
          strict: true
        }
      }) satisfies Tool
  ) as Tool[],

  callTools: async (calls: ToolCall[]): Promise<ToolMessage[]> =>
    Promise.all(
      calls.map(async call => {
        let tool = tools.getTool(call.function.name);
        if (!tool) {
          return {
            toolCallId: call.id,
            role: 'tool' as const,
            content: `[ERROR] Tool with name "${call.function.name}" not found.`
          } satisfies ToolMessage;
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
            toolCallId: call.id,
            role: 'tool' as const,
            content: `[ERROR] Invalid JSON in tool call arguments: ${e.message}`
          } satisfies ToolMessage;
        }

        try {
          let result = await tool.call(data);

          return {
            toolCallId: call.id,
            role: 'tool' as const,
            content: JSON.stringify(result)
          } satisfies ToolMessage;
        } catch (e: any) {
          return {
            toolCallId: call.id,
            role: 'tool' as const,
            content: `[ERROR] Tool call failed: ${e.message}`
          } satisfies ToolMessage;
        }
      })
    )
}));
