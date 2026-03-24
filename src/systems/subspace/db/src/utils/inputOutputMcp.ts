import type { SessionMessage } from '@metorial-subspace/db';

export let messageOutputToToolCall = async (
  output: PrismaJson.SessionMessageOutput,
  _message: SessionMessage | undefined | null
) => {
  if (!output) return null;

  if (output.type === 'mcp') {
    if ('params' in output.data && output.data.params)
      return output.data.params?.arguments ?? output.data.params;
    if ('result' in output.data && output.data.result) {
      if (output.data.result?.structuredContent) return output.data.result.structuredContent;
      if ('content' in output.data.result && (output.data.result?.content as any)?.length) {
        let items = output.data.result?.content as any[];
        if (items.length === 1 && items[0].type === 'text') {
          try {
            return JSON.parse(items[0].text);
          } catch {
            return items[0];
          }
        }
      }
      return output.data.result;
    }
    if ('error' in output.data && output.data.error) return output.data.error;
    return {};
  }

  if (output.type === 'tool.result') {
    return output.data;
  }

  return output.data;
};

export let messageInputToToolCall = async (
  input: PrismaJson.SessionMessageInput,
  _message: SessionMessage | undefined | null
) => {
  if (!input) return null;

  if (input.type === 'mcp') {
    if ('params' in input.data && input.data.params)
      return input.data.params?.arguments ?? input.data.params;
    if ('result' in input.data && input.data.result)
      return input.data.result?.structuredContent ?? input.data.result;
    if ('error' in input.data && input.data.error) return input.data.error;
    return {};
  }

  if (input.type === 'tool.call') {
    return input.data;
  }

  return {};
};
