import {
  MessageParam,
  ToolResultBlockParam,
  ToolUnion,
  ToolUseBlock
} from '@anthropic-ai/sdk/resources/messages';
import { createMcpSdk } from '@metorial/mcp-sdk-utils';

export let metorialAnthropic = createMcpSdk()(async ({ tools }) => ({
  tools: tools.getTools().map(
    t =>
      ({
        name: t.id,
        description: t.description ?? undefined,
        input_schema: t.getParametersAs('json-schema') as any
      }) satisfies ToolUnion
  ) as ToolUnion[],

  callTools: async (calls: ToolUseBlock[]): Promise<MessageParam> => ({
    role: 'user',
    content: await Promise.all(
      calls.map(async call => {
        let tool = tools.getTool(call.name);
        if (!tool) {
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: `[ERROR] Tool with name "${call.name}" not found.`
          } satisfies ToolResultBlockParam;
        }

        let data: any = {};

        try {
          if (typeof call.input == 'string') {
            data = JSON.parse(call.input);
          } else {
            data = call.input;
          }
        } catch (e: any) {
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: `[ERROR] Invalid JSON in tool call arguments: ${e.message}`
          } satisfies ToolResultBlockParam;
        }

        try {
          let result = await tool.call(data);

          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify(result)
          } satisfies ToolResultBlockParam;
        } catch (e: any) {
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: `[ERROR] Tool call failed: ${e.message}`
          } satisfies ToolResultBlockParam;
        }
      })
    )
  })
}));
