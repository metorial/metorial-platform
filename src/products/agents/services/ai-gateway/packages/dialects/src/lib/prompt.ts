import type {
  LanguageModelV4Message,
  LanguageModelV4Prompt,
  LanguageModelV4ToolResultPart
} from '@ai-sdk/provider';
import { invalidParam } from './errors';

type AssistantPart = Extract<LanguageModelV4Message, { role: 'assistant' }>['content'][number];

type UserPart = Extract<LanguageModelV4Message, { role: 'user' }>['content'][number];

// Builds a prompt while keeping the shape providers expect: consecutive assistant output (text,
// reasoning, tool calls) forms one assistant message and consecutive tool results one tool
// message, regardless of how granular the dialect's own items are.
export let createPromptBuilder = () => {
  let prompt: LanguageModelV4Prompt = [];
  let toolNames = new Map<string, string>();

  let last = () => prompt[prompt.length - 1];

  return {
    system: (content: string, providerOptions?: LanguageModelV4Message['providerOptions']) => {
      prompt.push({ role: 'system', content, providerOptions });
    },

    user: (
      content: UserPart[],
      providerOptions?: LanguageModelV4Message['providerOptions']
    ) => {
      if (!content.length) return;
      prompt.push({ role: 'user', content, providerOptions });
    },

    assistant: (content: AssistantPart[], d: { merge?: boolean } = {}) => {
      for (let part of content) {
        if (part.type == 'tool-call') toolNames.set(part.toolCallId, part.toolName);
      }

      let previous = last();
      if (d.merge && previous?.role == 'assistant') {
        previous.content.push(...content);
        return;
      }

      prompt.push({ role: 'assistant', content });
    },

    toolResult: (part: Omit<LanguageModelV4ToolResultPart, 'toolName'>, path: string) => {
      let toolName = toolNames.get(part.toolCallId);
      if (toolName === undefined) {
        throw invalidParam(
          path,
          `No earlier assistant tool call has the id "${part.toolCallId}" this result answers.`
        );
      }

      let result: LanguageModelV4ToolResultPart = { ...part, toolName };
      let previous = last();
      if (previous?.role == 'tool') {
        previous.content.push(result);
        return;
      }

      prompt.push({ role: 'tool', content: [result] });
    },

    build: () => prompt
  };
};
