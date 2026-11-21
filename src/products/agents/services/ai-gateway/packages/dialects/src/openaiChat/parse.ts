import type {
  LanguageModelV4FunctionTool,
  LanguageModelV4Message,
  LanguageModelV4ToolChoice,
  SharedV4ProviderOptions
} from '@ai-sdk/provider';
import { reasoningOptionsFromSignature } from '../lib/envelope';
import { invalidParam, unsupportedParam } from '../lib/errors';
import { filePartFromBase64, filePartFromUrl, parseDataUrl } from '../lib/media';
import {
  assertKnownTool,
  assertUniqueToolNames,
  functionTool,
  mergeProviderOptions,
  readJsonSchema,
  readJsonSchemaFormat,
  readToolName,
  reasoningEfforts,
  stringOrTextParts
} from '../lib/options';
import { createPromptBuilder } from '../lib/prompt';
import {
  at,
  index,
  optional,
  parseJsonArguments,
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
  logit_bias: 'Logit bias is not supported by the gateway.',
  top_logprobs: 'Log probabilities are not supported by the gateway.',
  audio: 'Audio output is not supported by the gateway.',
  prediction: 'Predicted outputs are not supported by the gateway.',
  web_search_options: 'Hosted web search is not supported by the gateway.',
  functions: 'The legacy "functions" parameter is not supported; use "tools".',
  function_call: 'The legacy "function_call" parameter is not supported; use "tool_choice".'
};

let audioMediaTypes: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg'
};

let anthropicNativeSignature = (signature: string): SharedV4ProviderOptions => ({
  anthropic: { signature }
});

let readUserContent = (value: unknown, path: string): UserPart[] => {
  if (typeof value == 'string') return [{ type: 'text', text: value }];

  return readArray(value, path).map((raw, position): UserPart => {
    let partPath = index(path, position);
    let part = readObject(raw, partPath);

    if (part.type == 'text')
      return { type: 'text', text: readString(part.text, at(partPath, 'text')) };

    if (part.type == 'image_url') {
      let image = readObject(part.image_url, at(partPath, 'image_url'));
      let detail = optional(image.detail, value =>
        readEnum(value, at(partPath, 'image_url.detail'), ['auto', 'low', 'high'])
      );

      return filePartFromUrl({
        url: readString(image.url, at(partPath, 'image_url.url')),
        path: at(partPath, 'image_url.url'),
        fallbackMediaType: 'image',
        providerOptions: detail ? { openai: { imageDetail: detail } } : undefined
      });
    }

    if (part.type == 'input_audio') {
      let audio = readObject(part.input_audio, at(partPath, 'input_audio'));
      let format = readEnum(audio.format, at(partPath, 'input_audio.format'), ['wav', 'mp3']);

      return filePartFromBase64({
        data: readString(audio.data, at(partPath, 'input_audio.data')),
        mediaType: audioMediaTypes[format]!
      });
    }

    if (part.type == 'file') {
      let file = readObject(part.file, at(partPath, 'file'));
      if (file.file_id !== undefined) {
        throw unsupportedParam(
          at(partPath, 'file.file_id'),
          'Uploaded file ids are not supported; send the file inline as "file_data".'
        );
      }

      let fileData = readString(file.file_data, at(partPath, 'file.file_data'));
      let filename = optional(file.filename, value =>
        readString(value, at(partPath, 'file.filename'))
      );
      let dataUrl = parseDataUrl(fileData);

      return dataUrl
        ? filePartFromBase64({ data: dataUrl.data, mediaType: dataUrl.mediaType, filename })
        : filePartFromBase64({ data: fileData, mediaType: 'application/pdf', filename });
    }

    throw invalidParam(
      at(partPath, 'type'),
      `Unknown user content part type "${String(part.type)}".`
    );
  });
};

let readReasoningParts = (message: JsonObject, path: string): AssistantPart[] => {
  if (Array.isArray(message.reasoning_details)) {
    return message.reasoning_details.flatMap((raw, position): AssistantPart[] => {
      let detailPath = index(at(path, 'reasoning_details'), position);
      let detail = readObject(raw, detailPath);

      if (detail.type == 'reasoning.text') {
        return [
          {
            type: 'reasoning',
            text:
              optional(detail.text, value => readString(value, at(detailPath, 'text'))) ?? '',
            providerOptions: reasoningOptionsFromSignature(
              optional(detail.signature, value =>
                readString(value, at(detailPath, 'signature'))
              ),
              anthropicNativeSignature
            )
          }
        ];
      }

      if (detail.type == 'reasoning.encrypted') {
        let data = readString(detail.data, at(detailPath, 'data'));
        return [
          {
            type: 'reasoning',
            text: '',
            providerOptions: reasoningOptionsFromSignature(data, value => ({
              anthropic: { redactedData: value }
            }))
          }
        ];
      }

      return [];
    });
  }

  let reasoning = message.reasoning_content ?? message.reasoning;
  if (typeof reasoning == 'string' && reasoning.length)
    return [{ type: 'reasoning', text: reasoning }];

  return [];
};

let readAssistantContent = (message: JsonObject, path: string): AssistantPart[] => {
  let parts: AssistantPart[] = readReasoningParts(message, path);

  if (typeof message.content == 'string') {
    if (message.content.length) parts.push({ type: 'text', text: message.content });
  } else if (Array.isArray(message.content)) {
    message.content.forEach((raw, position) => {
      let partPath = index(at(path, 'content'), position);
      let part = readObject(raw, partPath);

      if (part.type == 'text')
        parts.push({ type: 'text', text: readString(part.text, at(partPath, 'text')) });
      else if (part.type == 'refusal') {
        parts.push({ type: 'text', text: readString(part.refusal, at(partPath, 'refusal')) });
      } else {
        throw invalidParam(
          at(partPath, 'type'),
          `Assistant content parts must be "text" or "refusal", got "${String(part.type)}".`
        );
      }
    });
  } else if (message.content !== undefined && message.content !== null) {
    throw invalidParam(
      at(path, 'content'),
      `"${at(path, 'content')}" must be a string, an array or null.`
    );
  }

  if (message.tool_calls !== undefined && message.tool_calls !== null) {
    readArray(message.tool_calls, at(path, 'tool_calls')).forEach((raw, position) => {
      let callPath = index(at(path, 'tool_calls'), position);
      let call = readObject(raw, callPath);
      if (call.type !== undefined && call.type != 'function') {
        throw unsupportedParam(
          at(callPath, 'type'),
          'Only function tool calls are supported.'
        );
      }

      let fn = readObject(call.function, at(callPath, 'function'));
      parts.push({
        type: 'tool-call',
        toolCallId: readString(call.id, at(callPath, 'id')),
        toolName: readString(fn.name, at(callPath, 'function.name')),
        input: parseJsonArguments(
          readString(fn.arguments ?? '{}', at(callPath, 'function.arguments'))
        )
      });
    });
  }

  return parts;
};

let readToolContent = (value: unknown, path: string) => {
  if (typeof value == 'string') return value;
  return stringOrTextParts(value, path);
};

let readTools = (value: unknown): LanguageModelV4FunctionTool[] | undefined => {
  if (value === undefined || value === null) return undefined;

  let tools = readArray(value, 'tools').map((raw, position) => {
    let path = index('tools', position);
    let tool = readObject(raw, path);
    if (tool.type != 'function') {
      throw unsupportedParam(
        at(path, 'type'),
        `Only "function" tools are supported, got "${String(tool.type)}".`
      );
    }

    let fn = readObject(tool.function, at(path, 'function'));
    return functionTool({
      name: readToolName(fn.name, at(path, 'function.name')),
      description: optional(fn.description, value =>
        readString(value, at(path, 'function.description'))
      ),
      schema: readJsonSchema(fn.parameters, at(path, 'function.parameters')),
      strict: optional(fn.strict, value => readBoolean(value, at(path, 'function.strict')))
    });
  });

  assertUniqueToolNames(tools, 'tools');
  return tools.length ? tools : undefined;
};

let readToolChoice = (
  value: unknown,
  tools: LanguageModelV4FunctionTool[] | undefined
): LanguageModelV4ToolChoice | undefined => {
  if (value === undefined || value === null) return undefined;

  if (typeof value == 'string') {
    let mode = readEnum(value, 'tool_choice', ['auto', 'none', 'required']);
    return { type: mode };
  }

  let choice = readObject(value, 'tool_choice');
  if (choice.type == 'allowed_tools') {
    throw unsupportedParam('tool_choice', 'An "allowed_tools" tool choice is not supported.');
  }
  if (choice.type != 'function') {
    throw invalidParam('tool_choice.type', '"tool_choice.type" must be "function".');
  }

  let name = readString(
    readObject(choice.function, 'tool_choice.function').name,
    'tool_choice.function.name'
  );
  assertKnownTool(tools, name, 'tool_choice.function.name');

  return { type: 'tool', toolName: name };
};

let readResponseFormat = (value: unknown): CallOptions['responseFormat'] => {
  if (value === undefined || value === null) return undefined;

  let format = readObject(value, 'response_format');
  if (format.type == 'text') return { type: 'text' };
  if (format.type == 'json_object') return { type: 'json' };
  if (format.type == 'json_schema') {
    let schema = readJsonSchemaFormat(format.json_schema, 'response_format.json_schema');
    return {
      type: 'json',
      schema: schema.schema,
      name: schema.name,
      description: schema.description
    };
  }

  throw invalidParam(
    'response_format.type',
    '"response_format.type" must be "text", "json_object" or "json_schema".'
  );
};

let readStop = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value == 'string') return [value];

  return readArray(value, 'stop').map((entry, position) =>
    readString(entry, index('stop', position))
  );
};

export let parseOpenAIChatRequest = (raw: unknown): ParsedRequest => {
  let body = readObject(raw, 'body');
  let model = readModel(body.model);

  rejectPresent(body, Object.keys(unsupported), key => unsupported[key]!);

  let n = optional(body.n, value => readNumber(value, 'n', { integer: true, min: 1 }));
  if (n !== undefined && n > 1)
    throw unsupportedParam('n', 'Only one choice per request (n = 1) is supported.');
  if (body.logprobs === true)
    throw unsupportedParam('logprobs', 'Log probabilities are not supported by the gateway.');

  let modalities = optional(body.modalities, value => readArray(value, 'modalities'));
  if (modalities?.some(modality => modality != 'text')) {
    throw unsupportedParam('modalities', 'Only text output is supported.');
  }

  let builder = createPromptBuilder();
  let messages = readArray(body.messages, 'messages');
  if (!messages.length)
    throw invalidParam('messages', '"messages" must contain at least one message.');

  messages.forEach((raw, position) => {
    let path = index('messages', position);
    let message = readObject(raw, path);
    let role = message.role;

    if (role == 'system' || role == 'developer') {
      builder.system(stringOrTextParts(message.content, at(path, 'content')));
      return;
    }

    if (role == 'user') {
      builder.user(readUserContent(message.content, at(path, 'content')));
      return;
    }

    if (role == 'assistant') {
      builder.assistant(readAssistantContent(message, path));
      return;
    }

    if (role == 'tool') {
      builder.toolResult(
        {
          type: 'tool-result',
          toolCallId: readString(message.tool_call_id, at(path, 'tool_call_id')),
          output: {
            type: 'text',
            value: readToolContent(message.content, at(path, 'content'))
          }
        },
        at(path, 'tool_call_id')
      );
      return;
    }

    if (role == 'function') {
      throw unsupportedParam(
        at(path, 'role'),
        'Legacy "function" messages are not supported; use "tool".'
      );
    }

    throw invalidParam(at(path, 'role'), `Unknown message role "${String(role)}".`);
  });

  let tools = readTools(body.tools);
  let streamOptions = optional(body.stream_options, value =>
    readObject(value, 'stream_options')
  );
  let parallelToolCalls = optional(body.parallel_tool_calls, value =>
    readBoolean(value, 'parallel_tool_calls')
  );
  let reasoning = optional(body.reasoning_effort, value =>
    readEnum(value, 'reasoning_effort', reasoningEfforts)
  );

  let options: CallOptions = {
    prompt: builder.build(),
    maxOutputTokens: optional(body.max_completion_tokens ?? body.max_tokens, value =>
      readNumber(
        value,
        body.max_completion_tokens != null ? 'max_completion_tokens' : 'max_tokens',
        {
          integer: true,
          min: 1
        }
      )
    ),
    temperature: optional(body.temperature, value =>
      readNumber(value, 'temperature', { min: 0, max: 2 })
    ),
    topP: optional(body.top_p, value => readNumber(value, 'top_p', { min: 0, max: 1 })),
    presencePenalty: optional(body.presence_penalty, value =>
      readNumber(value, 'presence_penalty', { min: -2, max: 2 })
    ),
    frequencyPenalty: optional(body.frequency_penalty, value =>
      readNumber(value, 'frequency_penalty', { min: -2, max: 2 })
    ),
    seed: optional(body.seed, value => readNumber(value, 'seed', { integer: true })),
    stopSequences: readStop(body.stop),
    responseFormat: readResponseFormat(body.response_format),
    tools,
    toolChoice: readToolChoice(body.tool_choice, tools),
    reasoning,
    providerOptions: mergeProviderOptions(
      {
        openai: {
          parallelToolCalls,
          promptCacheKey: optional(body.prompt_cache_key, value =>
            readString(value, 'prompt_cache_key')
          ),
          textVerbosity: optional(body.verbosity, value =>
            readEnum(value, 'verbosity', ['low', 'medium', 'high'])
          )
        }
      },
      parallelToolCalls === false ? { anthropic: { disableParallelToolUse: true } } : undefined
    )
  };

  return {
    dialect: 'openai_chat',
    model,
    stream: optional(body.stream, value => readBoolean(value, 'stream')) ?? false,
    streamUsage: streamOptions?.include_usage === true,
    options,
    echo: {}
  };
};
