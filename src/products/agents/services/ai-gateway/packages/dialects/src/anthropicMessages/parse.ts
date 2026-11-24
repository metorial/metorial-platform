import type {
  LanguageModelV4FilePart,
  LanguageModelV4FunctionTool,
  LanguageModelV4Message,
  LanguageModelV4ToolChoice,
  LanguageModelV4ToolResultOutput,
  SharedV4ProviderOptions
} from '@ai-sdk/provider';
import { reasoningOptionsFromSignature } from '../lib/envelope';
import { invalidParam, unsupportedParam } from '../lib/errors';
import { filePartFromBase64, filePartFromUrl } from '../lib/media';
import {
  assertKnownTool,
  assertUniqueToolNames,
  functionTool,
  mergeProviderOptions,
  readJsonSchema,
  readToolName,
  type ReasoningEffort
} from '../lib/options';
import { createPromptBuilder } from '../lib/prompt';
import {
  at,
  index,
  isObject,
  optional,
  readArray,
  readBoolean,
  readEnum,
  readNumber,
  readObject,
  readModel,
  readString,
  rejectPresent,
  type JsonObject
} from '../lib/read';
import type { CallOptions, ParsedRequest } from '../lib/types';

type UserPart = Extract<LanguageModelV4Message, { role: 'user' }>['content'][number];

type AssistantPart = Extract<LanguageModelV4Message, { role: 'assistant' }>['content'][number];

let unsupported: Record<string, string> = {
  container: 'Code execution containers are not supported by the gateway.',
  mcp_servers: 'Remote MCP servers are not supported by the gateway.',
  context_management: 'Context management is not supported by the gateway.'
};

let cacheOptions = (block: JsonObject, path: string): SharedV4ProviderOptions | undefined => {
  if (block.cache_control === undefined || block.cache_control === null) return undefined;

  let cache = readObject(block.cache_control, at(path, 'cache_control'));
  readEnum(cache.type, at(path, 'cache_control.type'), ['ephemeral']);
  let ttl = optional(cache.ttl, value =>
    readEnum(value, at(path, 'cache_control.ttl'), ['5m', '1h'])
  );

  return { anthropic: { cacheControl: { type: 'ephemeral', ...(ttl ? { ttl } : {}) } } };
};

let readImage = (block: JsonObject, path: string): LanguageModelV4FilePart => {
  let source = readObject(block.source, at(path, 'source'));
  let providerOptions = cacheOptions(block, path);

  if (source.type == 'base64') {
    return filePartFromBase64({
      data: readString(source.data, at(path, 'source.data')),
      mediaType: readString(source.media_type, at(path, 'source.media_type')),
      providerOptions
    });
  }

  if (source.type == 'url') {
    return filePartFromUrl({
      url: readString(source.url, at(path, 'source.url')),
      path: at(path, 'source.url'),
      fallbackMediaType: 'image',
      providerOptions
    });
  }

  throw unsupportedParam(
    at(path, 'source.type'),
    `Image sources of type "${String(source.type)}" are not supported; send "base64" or "url".`
  );
};

let readDocument = (block: JsonObject, path: string): LanguageModelV4FilePart => {
  let source = readObject(block.source, at(path, 'source'));
  let filename = optional(block.title, value => readString(value, at(path, 'title')));
  let citations = optional(block.citations, value => readObject(value, at(path, 'citations')));
  let providerOptions = mergeProviderOptions(
    cacheOptions(block, path),
    citations
      ? { anthropic: { citations: { enabled: citations.enabled === true } } }
      : undefined
  );

  if (source.type == 'base64') {
    return filePartFromBase64({
      data: readString(source.data, at(path, 'source.data')),
      mediaType: readString(source.media_type, at(path, 'source.media_type')),
      filename,
      providerOptions
    });
  }

  if (source.type == 'url') {
    return filePartFromUrl({
      url: readString(source.url, at(path, 'source.url')),
      path: at(path, 'source.url'),
      fallbackMediaType: 'application/pdf',
      filename,
      providerOptions
    });
  }

  if (source.type == 'text') {
    return {
      type: 'file',
      mediaType: 'text/plain',
      data: { type: 'text', text: readString(source.data, at(path, 'source.data')) },
      filename,
      providerOptions
    };
  }

  throw unsupportedParam(
    at(path, 'source.type'),
    `Document sources of type "${String(source.type)}" are not supported.`
  );
};

let readToolResultOutput = (
  block: JsonObject,
  path: string
): LanguageModelV4ToolResultOutput => {
  let isError =
    optional(block.is_error, value => readBoolean(value, at(path, 'is_error'))) ?? false;
  let content = block.content ?? '';

  if (typeof content == 'string') {
    return isError ? { type: 'error-text', value: content } : { type: 'text', value: content };
  }

  let parts = readArray(content, at(path, 'content')).map((raw, position) => {
    let partPath = index(at(path, 'content'), position);
    let part = readObject(raw, partPath);

    if (part.type == 'text') {
      return { type: 'text' as const, text: readString(part.text, at(partPath, 'text')) };
    }
    if (part.type == 'image') return readImage(part, partPath);
    if (part.type == 'document') return readDocument(part, partPath);

    throw invalidParam(
      at(partPath, 'type'),
      `Tool results may contain text, image or document blocks, got "${String(part.type)}".`
    );
  });

  if (parts.every(part => part.type == 'text')) {
    let text = parts.map(part => part.text).join('\n\n');
    return isError ? { type: 'error-text', value: text } : { type: 'text', value: text };
  }

  return {
    type: 'content',
    value: parts.map(part =>
      part.type == 'text'
        ? part
        : {
            type: 'file' as const,
            data: part.data,
            mediaType: part.mediaType,
            filename: part.filename
          }
    )
  };
};

let anthropicNativeSignature = (signature: string): SharedV4ProviderOptions => ({
  anthropic: { signature }
});

let readAssistantBlock = (block: JsonObject, path: string): AssistantPart => {
  let providerOptions = cacheOptions(block, path);

  if (block.type == 'text') {
    return { type: 'text', text: readString(block.text, at(path, 'text')), providerOptions };
  }

  if (block.type == 'thinking') {
    return {
      type: 'reasoning',
      text: readString(block.thinking, at(path, 'thinking')),
      providerOptions: reasoningOptionsFromSignature(
        optional(block.signature, value => readString(value, at(path, 'signature'))),
        anthropicNativeSignature
      )
    };
  }

  if (block.type == 'redacted_thinking') {
    let data = readString(block.data, at(path, 'data'));
    return {
      type: 'reasoning',
      text: '',
      providerOptions: reasoningOptionsFromSignature(data, value => ({
        anthropic: { redactedData: value }
      }))
    };
  }

  if (block.type == 'tool_use') {
    return {
      type: 'tool-call',
      toolCallId: readString(block.id, at(path, 'id')),
      toolName: readString(block.name, at(path, 'name')),
      input: block.input ?? {},
      providerOptions
    };
  }

  throw unsupportedParam(
    at(path, 'type'),
    `Assistant content blocks of type "${String(block.type)}" are not supported.`
  );
};

let readTools = (value: unknown): LanguageModelV4FunctionTool[] | undefined => {
  if (value === undefined || value === null) return undefined;

  let tools = readArray(value, 'tools').map((raw, position) => {
    let path = index('tools', position);
    let tool = readObject(raw, path);

    if (tool.type !== undefined && tool.type !== null && tool.type != 'custom') {
      throw unsupportedParam(
        at(path, 'type'),
        `Server tools like "${String(tool.type)}" are not supported; only custom tools are.`
      );
    }

    return functionTool({
      name: readToolName(tool.name, at(path, 'name')),
      description: optional(tool.description, value =>
        readString(value, at(path, 'description'))
      ),
      schema: readJsonSchema(tool.input_schema, at(path, 'input_schema')),
      strict: optional(tool.strict, value => readBoolean(value, at(path, 'strict'))),
      providerOptions: cacheOptions(tool, path)
    });
  });

  assertUniqueToolNames(tools, 'tools');
  return tools.length ? tools : undefined;
};

let readToolChoice = (value: unknown, tools: LanguageModelV4FunctionTool[] | undefined) => {
  if (value === undefined || value === null)
    return { choice: undefined, disableParallel: undefined };

  let choice = readObject(value, 'tool_choice');
  let type = readEnum(choice.type, 'tool_choice.type', ['auto', 'any', 'tool', 'none']);
  let disableParallel = optional(choice.disable_parallel_tool_use, value =>
    readBoolean(value, 'tool_choice.disable_parallel_tool_use')
  );

  let mapped: LanguageModelV4ToolChoice =
    type == 'any'
      ? { type: 'required' }
      : type == 'tool'
        ? { type: 'tool', toolName: '' }
        : { type };

  if (mapped.type == 'tool') {
    let name = readString(choice.name, 'tool_choice.name');
    assertKnownTool(tools, name, 'tool_choice.name');
    mapped = { type: 'tool', toolName: name };
  }

  return { choice: mapped, disableParallel };
};

// Thinking budgets translate to an effort for providers that only understand efforts. The
// Anthropic provider itself keeps reading the exact budget from its own options.
let effortForBudget = (budget: number): ReasoningEffort => {
  if (budget <= 2048) return 'low';
  if (budget <= 8192) return 'medium';
  return 'high';
};

let readThinking = (
  value: unknown
): {
  reasoning: ReasoningEffort | undefined;
  thinking: { type: string; budgetTokens?: number } | undefined;
} => {
  if (value === undefined || value === null)
    return { reasoning: undefined, thinking: undefined };

  let thinking = readObject(value, 'thinking');
  let type = readEnum(thinking.type, 'thinking.type', ['enabled', 'disabled', 'adaptive']);

  if (type == 'disabled') return { reasoning: 'none' as const, thinking: { type } };
  if (type == 'adaptive') return { reasoning: undefined, thinking: { type } };

  let budget = readNumber(thinking.budget_tokens, 'thinking.budget_tokens', {
    integer: true,
    min: 1024
  });
  return { reasoning: effortForBudget(budget), thinking: { type, budgetTokens: budget } };
};

let readOutputConfig = (value: unknown) => {
  if (value === undefined || value === null)
    return { effort: undefined, responseFormat: undefined };

  let config = readObject(value, 'output_config');
  let effort = optional(config.effort, value =>
    readEnum(value, 'output_config.effort', ['low', 'medium', 'high', 'xhigh', 'max'])
  );

  let responseFormat: CallOptions['responseFormat'];
  if (config.format !== undefined && config.format !== null) {
    let format = readObject(config.format, 'output_config.format');
    readEnum(format.type, 'output_config.format.type', ['json_schema']);
    responseFormat = {
      type: 'json',
      schema: readJsonSchema(format.schema, 'output_config.format.schema')
    };
  }

  return { effort, responseFormat };
};

export let parseAnthropicMessagesRequest = (
  raw: unknown,
  d: { countTokens?: boolean } = {}
): ParsedRequest => {
  let body = readObject(raw, 'body');
  let model = readModel(body.model);

  rejectPresent(body, Object.keys(unsupported), key => unsupported[key]!);

  let builder = createPromptBuilder();

  if (typeof body.system == 'string') {
    if (body.system.length) builder.system(body.system);
  } else if (body.system !== undefined && body.system !== null) {
    readArray(body.system, 'system').forEach((raw, position) => {
      let path = index('system', position);
      let block = readObject(raw, path);
      if (block.type != 'text')
        throw invalidParam(at(path, 'type'), 'System blocks must be text blocks.');

      builder.system(readString(block.text, at(path, 'text')), cacheOptions(block, path));
    });
  }

  let messages = readArray(body.messages, 'messages');
  if (!messages.length)
    throw invalidParam('messages', '"messages" must contain at least one message.');

  messages.forEach((raw, position) => {
    let path = index('messages', position);
    let message = readObject(raw, path);
    let role = readEnum(message.role, at(path, 'role'), ['user', 'assistant']);
    let contentPath = at(path, 'content');

    let blocks: JsonObject[] =
      typeof message.content == 'string'
        ? [{ type: 'text', text: message.content }]
        : readArray(message.content, contentPath).map((block, blockIndex) =>
            readObject(block, index(contentPath, blockIndex))
          );

    if (role == 'assistant') {
      builder.assistant(
        blocks.map((block, blockIndex) =>
          readAssistantBlock(block, index(contentPath, blockIndex))
        )
      );
      return;
    }

    let userParts: UserPart[] = [];
    blocks.forEach((block, blockIndex) => {
      let blockPath = index(contentPath, blockIndex);

      if (block.type == 'tool_result') {
        builder.toolResult(
          {
            type: 'tool-result',
            toolCallId: readString(block.tool_use_id, at(blockPath, 'tool_use_id')),
            output: readToolResultOutput(block, blockPath),
            providerOptions: cacheOptions(block, blockPath)
          },
          at(blockPath, 'tool_use_id')
        );
        return;
      }

      if (block.type == 'text') {
        userParts.push({
          type: 'text',
          text: readString(block.text, at(blockPath, 'text')),
          providerOptions: cacheOptions(block, blockPath)
        });
        return;
      }

      if (block.type == 'image') {
        userParts.push(readImage(block, blockPath));
        return;
      }

      if (block.type == 'document') {
        userParts.push(readDocument(block, blockPath));
        return;
      }

      throw unsupportedParam(
        at(blockPath, 'type'),
        `User content blocks of type "${String(block.type)}" are not supported.`
      );
    });

    builder.user(userParts);
  });

  let tools = readTools(body.tools);
  let toolChoice = readToolChoice(body.tool_choice, tools);
  let thinking = readThinking(body.thinking);
  let outputConfig = readOutputConfig(body.output_config);

  let maxTokens = d.countTokens
    ? optional(body.max_tokens, value =>
        readNumber(value, 'max_tokens', { integer: true, min: 1 })
      )
    : readNumber(body.max_tokens, 'max_tokens', { integer: true, min: 1 });

  let options: CallOptions = {
    prompt: builder.build(),
    maxOutputTokens: maxTokens,
    temperature: optional(body.temperature, value =>
      readNumber(value, 'temperature', { min: 0, max: 1 })
    ),
    topP: optional(body.top_p, value => readNumber(value, 'top_p', { min: 0, max: 1 })),
    topK: optional(body.top_k, value => readNumber(value, 'top_k', { integer: true, min: 0 })),
    stopSequences: optional(body.stop_sequences, value =>
      readArray(value, 'stop_sequences').map((entry, position) =>
        readString(entry, index('stop_sequences', position))
      )
    ),
    responseFormat: outputConfig.responseFormat,
    tools,
    toolChoice: toolChoice.choice,
    reasoning: outputConfig.effort ?? thinking.reasoning,
    providerOptions: mergeProviderOptions(
      {
        anthropic: {
          thinking: thinking.thinking,
          effort: outputConfig.effort,
          disableParallelToolUse: toolChoice.disableParallel
        }
      },
      toolChoice.disableParallel ? { openai: { parallelToolCalls: false } } : undefined
    )
  };

  return {
    dialect: 'anthropic_messages',
    model,
    stream: d.countTokens
      ? false
      : (optional(body.stream, value => readBoolean(value, 'stream')) ?? false),
    streamUsage: true,
    options,
    echo: {}
  };
};
