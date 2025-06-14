import { createMcpSdk } from '@metorial/mcp-sdk-utils';
import { createOpenAICompatibleMcpSdk } from '@metorial/openai-compatible';
import type {
  ResponseFunctionToolCall,
  ResponseFunctionToolCallItem,
  ResponseInputItem
} from 'openai/resources/responses/responses';
import type { FunctionParameters } from 'openai/resources/shared';

export let metorialOpenAI = {
  chatCompletions: createOpenAICompatibleMcpSdk({ withStrict: true }),

  responses: createMcpSdk()(async ({ session, tools }) => ({
    tools: tools.getTools().map(t => ({
      type: 'function' as const,
      name: t.id,
      description: t.description ?? undefined,
      parameters: t.getParametersAs('json-schema') as FunctionParameters,
      strict: true
    })),

    callTools: async (
      calls: (ResponseFunctionToolCall | ResponseFunctionToolCallItem)[]
    ): Promise<ResponseInputItem.FunctionCallOutput[]> =>
      Promise.all(
        calls.map(async call => {
          let tool = tools.getTool(call.name);
          if (!tool) {
            return {
              call_id: call.call_id,
              type: 'function_call_output' as const,
              output: `[ERROR] Tool with name "${call.name}" not found.`
            } satisfies ResponseInputItem.FunctionCallOutput;
          }

          let data: any = {};

          try {
            data = JSON.parse(call.arguments);
          } catch (e: any) {
            return {
              call_id: call.call_id,
              type: 'function_call_output' as const,
              output: `[ERROR] Invalid JSON in tool call arguments: ${e.message}`
            } satisfies ResponseInputItem.FunctionCallOutput;
          }

          try {
            let result = await tool.call(data);

            return {
              call_id: call.call_id,
              type: 'function_call_output' as const,
              output: JSON.stringify(result)
            } satisfies ResponseInputItem.FunctionCallOutput;
          } catch (e: any) {
            return {
              call_id: call.call_id,
              type: 'function_call_output' as const,
              output: `[ERROR] Tool call failed: ${e.message}`
            } satisfies ResponseInputItem.FunctionCallOutput;
          }
        })
      )
  }))
};
