import { Content, FunctionCall, FunctionDeclaration, Part, ToolUnion } from '@google/genai';
import { createMcpSdk } from '@metorial/mcp-sdk-utils';

export let metorialGoogle = createMcpSdk()(async ({ tools }) => ({
  tools: [
    {
      functionDeclarations: tools.getTools().map(
        t =>
          ({
            name: t.id,
            description: t.description ?? undefined,
            parameters: t.getParametersAs('openapi-3.0.0') as any
          }) satisfies FunctionDeclaration
      )
    }
  ] as ToolUnion[],

  callTools: async (calls: FunctionCall[]): Promise<Content> => ({
    role: 'user',
    parts: await Promise.all(
      calls.map(async call => {
        let tool = tools.getTool(call.name!);
        if (!tool) {
          return {
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                error: `[ERROR] Tool with name "${call.name}" not found.`
              }
            }
          } satisfies Part;
        }

        let data: any = {};

        try {
          if (typeof call.args == 'string') {
            data = JSON.parse(call.args);
          } else {
            data = call.args;
          }
        } catch (e: any) {
          return {
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                error: `[ERROR] Invalid JSON in tool call arguments: ${e.message}`
              }
            }
          } satisfies Part;
        }

        try {
          let result = await tool.call(data);

          return {
            functionResponse: {
              id: call.id,
              name: call.name,
              response: result
            }
          } satisfies Part;
        } catch (e: any) {
          return {
            functionResponse: {
              id: call.id,
              name: call.name,
              response: {
                error: `[ERROR] Tool call failed: ${e.message}`
              }
            }
          } satisfies Part;
        }
      })
    )
  })
}));
