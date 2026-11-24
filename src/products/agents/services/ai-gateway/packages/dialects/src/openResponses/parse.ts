import type {
  LanguageModelV4FunctionTool,
  LanguageModelV4Message,
  LanguageModelV4ToolChoice,
  LanguageModelV4ToolResultOutput,
  SharedV4ProviderOptions
} from '@ai-sdk/provider';
import { decodeProviderMetadata } from '../lib/envelope';
import { invalidParam, unsupportedParam } from '../lib/errors';
import { filePartFromBase64, filePartFromUrl, parseDataUrl } from '../lib/media';
import {
  assertKnownTool,
  assertUniqueToolNames,
  functionTool,
  mergeProviderOptions,
  readJsonSchema,
  readToolName,
  reasoningEfforts
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
  previous_response_id:
    'The gateway does not store responses; send the full conversation in "input" instead.',
  conversation:
    'The gateway does not store conversations; send the full conversation in "input".',
  background: 'Background responses are not supported by the gateway.',
  prompt: 'Stored prompt templates are not supported by the gateway.',
  max_tool_calls: 'Limiting built-in tool calls is not supported by the gateway.',
  top_logprobs: 'Log probabilities are not supported by the gateway.'
};

let echoedFields = [
  'instructions',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'temperature',
  'top_p',
  'presence_penalty',
  'frequency_penalty',
  'max_output_tokens',
  'reasoning',
  'text',
  'truncation',
  'metadata',
  'prompt_cache_key',
  'safety_identifier',
  'service_tier',
  'user'
];

let readFile = (part: JsonObject, path: string) => {
  let filename = optional(part.filename, value => readString(value, at(path, 'filename')));

  if (part.file_id !== undefined && part.file_id !== null) {
    throw unsupportedParam(
      at(path, 'file_id'),
      'Uploaded file ids are not supported; send the file inline as "file_data" or "file_url".'
    );
  }

  if (part.file_url !== undefined && part.file_url !== null) {
    return filePartFromUrl({
      url: readString(part.file_url, at(path, 'file_url')),
      path: at(path, 'file_url'),
      fallbackMediaType: 'application/pdf',
      filename
    });
  }

  let data = readString(part.file_data, at(path, 'file_data'));
  let dataUrl = parseDataUrl(data);

  return dataUrl
    ? filePartFromBase64({ data: dataUrl.data, mediaType: dataUrl.mediaType, filename })
    : filePartFromBase64({ data, mediaType: 'application/pdf', filename });
};

let readImage = (part: JsonObject, path: string) => {
  if (part.file_id !== undefined && part.file_id !== null) {
    throw unsupportedParam(
      at(path, 'file_id'),
      'Uploaded file ids are not supported; send "image_url".'
    );
  }

  let detail = optional(part.detail, value =>
    readEnum(value, at(path, 'detail'), ['auto', 'low', 'high'])
  );
  return filePartFromUrl({
    url: readString(part.image_url, at(path, 'image_url')),
    path: at(path, 'image_url'),
    fallbackMediaType: 'image',
    providerOptions: detail ? { openai: { imageDetail: detail } } : undefined
  });
};

let readInputParts = (value: unknown, path: string): UserPart[] => {
  if (typeof value == 'string') return [{ type: 'text', text: value }];

  return readArray(value, path).map((raw, position): UserPart => {
    let partPath = index(path, position);
    let part = readObject(raw, partPath);

    if (part.type == 'input_text')
      return { type: 'text', text: readString(part.text, at(partPath, 'text')) };
    if (part.type == 'input_image') return readImage(part, partPath);
    if (part.type == 'input_file') return readFile(part, partPath);

    throw invalidParam(
      at(partPath, 'type'),
      `Unknown input content type "${String(part.type)}".`
    );
  });
};

let readSystemText = (value: unknown, path: string) =>
  readInputParts(value, path)
    .map((part, position) => {
      if (part.type != 'text') {
        throw invalidParam(
          index(path, position),
          'System and developer messages may only contain text.'
        );
      }
      return part.text;
    })
    .join('\n\n');

let readAssistantMessage = (value: unknown, path: string): AssistantPart[] => {
  if (typeof value == 'string') return [{ type: 'text', text: value }];

  return readArray(value, path).map((raw, position) => {
    let partPath = index(path, position);
    let part = readObject(raw, partPath);

    if (part.type == 'output_text')
      return { type: 'text', text: readString(part.text, at(partPath, 'text')) };
    if (part.type == 'refusal')
      return { type: 'text', text: readString(part.refusal, at(partPath, 'refusal')) };

    throw invalidParam(
      at(partPath, 'type'),
      `Assistant content must be "output_text" or "refusal", got "${String(part.type)}".`
    );
  });
};

let readReasoning = (item: JsonObject, path: string): AssistantPart[] => {
  let id = optional(item.id, value => readString(value, at(path, 'id')));
  let encrypted = optional(item.encrypted_content, value =>
    readString(value, at(path, 'encrypted_content'))
  );

  let texts = (field: string, type: string) =>
    optional(item[field], value =>
      readArray(value, at(path, field)).map((raw, position) => {
        let partPath = index(at(path, field), position);
        let part = readObject(raw, partPath);
        if (part.type != type)
          throw invalidParam(
            at(partPath, 'type'),
            `"${at(partPath, 'type')}" must be "${type}".`
          );

        return readString(part.text, at(partPath, 'text'));
      })
    ) ?? [];

  let summary = texts('summary', 'summary_text');
  let content = texts('content', 'reasoning_text');

  let decoded = encrypted ? decodeProviderMetadata(encrypted) : null;
  if (decoded)
    return [
      { type: 'reasoning', text: [...content, ...summary].join(''), providerOptions: decoded }
    ];

  let native: SharedV4ProviderOptions | undefined =
    id || encrypted
      ? { openai: { itemId: id, reasoningEncryptedContent: encrypted } }
      : undefined;
  let entries = content.length ? [content.join('')] : summary.length ? summary : [''];

  return entries.map(text => ({
    type: 'reasoning',
    text,
    providerOptions: mergeProviderOptions(native)
  }));
};

let readToolOutput = (value: unknown, path: string): LanguageModelV4ToolResultOutput => {
  if (typeof value == 'string') return { type: 'text', value };

  let parts = readInputParts(value, path);
  if (parts.every(part => part.type == 'text')) {
    return {
      type: 'text',
      value: parts.map(part => (part.type == 'text' ? part.text : '')).join('\n\n')
    };
  }

  return {
    type: 'content',
    value: parts.map(part =>
      part.type == 'text'
        ? { type: 'text' as const, text: part.text }
        : {
            type: 'file' as const,
            data: part.data,
            mediaType: part.mediaType,
            filename: part.filename
          }
    )
  };
};

let readTools = (value: unknown): LanguageModelV4FunctionTool[] | undefined => {
  if (value === undefined || value === null) return undefined;

  let tools = readArray(value, 'tools').map((raw, position) => {
    let path = index('tools', position);
    let tool = readObject(raw, path);
    if (tool.type != 'function') {
      throw unsupportedParam(
        at(path, 'type'),
        `Hosted tools like "${String(tool.type)}" are not supported; only "function" tools are.`
      );
    }

    return functionTool({
      name: readToolName(tool.name, at(path, 'name')),
      description: optional(tool.description, value =>
        readString(value, at(path, 'description'))
      ),
      schema: readJsonSchema(tool.parameters, at(path, 'parameters')),
      strict: optional(tool.strict, value => readBoolean(value, at(path, 'strict')))
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
  if (typeof value == 'string')
    return { type: readEnum(value, 'tool_choice', ['auto', 'none', 'required']) };

  let choice = readObject(value, 'tool_choice');
  if (choice.type != 'function') {
    throw unsupportedParam(
      'tool_choice.type',
      `Only "function" tool choices are supported, got "${String(choice.type)}".`
    );
  }

  let name = readString(choice.name, 'tool_choice.name');
  assertKnownTool(tools, name, 'tool_choice.name');

  return { type: 'tool', toolName: name };
};

let readTextFormat = (value: unknown) => {
  if (value === undefined || value === null)
    return { responseFormat: undefined, strict: undefined, verbosity: undefined };

  let text = readObject(value, 'text');
  let verbosity = optional(text.verbosity, value =>
    readEnum(value, 'text.verbosity', ['low', 'medium', 'high'])
  );
  if (text.format === undefined || text.format === null)
    return { responseFormat: undefined, strict: undefined, verbosity };

  let format = readObject(text.format, 'text.format');
  let type = readEnum(format.type, 'text.format.type', ['text', 'json_object', 'json_schema']);
  if (type == 'text')
    return { responseFormat: { type: 'text' as const }, strict: undefined, verbosity };
  if (type == 'json_object')
    return { responseFormat: { type: 'json' as const }, strict: undefined, verbosity };

  return {
    responseFormat: {
      type: 'json' as const,
      schema: readJsonSchema(format.schema, 'text.format.schema'),
      name: optional(format.name, value => readString(value, 'text.format.name')),
      description: optional(format.description, value =>
        readString(value, 'text.format.description')
      )
    },
    strict: optional(format.strict, value => readBoolean(value, 'text.format.strict')),
    verbosity
  };
};

export let parseOpenResponsesRequest = (raw: unknown): ParsedRequest => {
  let body = readObject(raw, 'body');
  let model = readModel(body.model);

  rejectPresent(body, Object.keys(unsupported), key => unsupported[key]!);

  if (body.store === true) {
    throw unsupportedParam(
      'store',
      'The gateway does not store responses; set "store" to false.'
    );
  }
  if (body.truncation == 'auto') {
    throw unsupportedParam(
      'truncation',
      'Automatic truncation is not supported; omit "truncation".'
    );
  }
  optional(body.truncation, value => readEnum(value, 'truncation', ['disabled', 'auto']));
  optional(body.service_tier, value => readEnum(value, 'service_tier', ['auto', 'default']));

  let include = optional(body.include, value =>
    readArray(value, 'include').map((entry, position) =>
      readString(entry, index('include', position))
    )
  );
  include?.forEach((entry, position) => {
    if (entry != 'reasoning.encrypted_content') {
      throw unsupportedParam(
        index('include', position),
        `Including "${entry}" is not supported.`
      );
    }
  });

  let builder = createPromptBuilder();
  let instructions = optional(body.instructions, value => readString(value, 'instructions'));
  if (instructions) builder.system(instructions);

  if (typeof body.input == 'string') {
    builder.user([{ type: 'text', text: body.input }]);
  } else {
    let input = readArray(body.input, 'input');
    if (!input.length) throw invalidParam('input', '"input" must contain at least one item.');

    input.forEach((raw, position) => {
      let path = index('input', position);
      let item = readObject(raw, path);
      let type = item.type ?? 'message';

      if (type == 'message') {
        let role = readEnum(item.role, at(path, 'role'), [
          'user',
          'assistant',
          'system',
          'developer'
        ]);
        let contentPath = at(path, 'content');

        if (role == 'user') builder.user(readInputParts(item.content, contentPath));
        else if (role == 'assistant')
          builder.assistant(readAssistantMessage(item.content, contentPath), { merge: true });
        else builder.system(readSystemText(item.content, contentPath));
        return;
      }

      if (type == 'function_call') {
        builder.assistant(
          [
            {
              type: 'tool-call',
              toolCallId: readString(item.call_id, at(path, 'call_id')),
              toolName: readString(item.name, at(path, 'name')),
              input: parseJsonArguments(
                readString(item.arguments ?? '{}', at(path, 'arguments'))
              )
            }
          ],
          { merge: true }
        );
        return;
      }

      if (type == 'function_call_output') {
        builder.toolResult(
          {
            type: 'tool-result',
            toolCallId: readString(item.call_id, at(path, 'call_id')),
            output: readToolOutput(item.output, at(path, 'output'))
          },
          at(path, 'call_id')
        );
        return;
      }

      if (type == 'reasoning') {
        builder.assistant(readReasoning(item, path), { merge: true });
        return;
      }

      if (type == 'item_reference') {
        throw unsupportedParam(
          at(path, 'type'),
          'The gateway does not store items; send the referenced item itself instead.'
        );
      }

      throw unsupportedParam(
        at(path, 'type'),
        `Input items of type "${String(type)}" are not supported.`
      );
    });
  }

  let reasoningConfig = optional(body.reasoning, value => readObject(value, 'reasoning'));
  let reasoning = optional(reasoningConfig?.effort, value =>
    readEnum(value, 'reasoning.effort', reasoningEfforts)
  );
  let reasoningSummary = optional(reasoningConfig?.summary, value =>
    readEnum(value, 'reasoning.summary', ['auto', 'concise', 'detailed'])
  );

  let tools = readTools(body.tools);
  let text = readTextFormat(body.text);
  let parallelToolCalls = optional(body.parallel_tool_calls, value =>
    readBoolean(value, 'parallel_tool_calls')
  );

  let options: CallOptions = {
    prompt: builder.build(),
    maxOutputTokens: optional(body.max_output_tokens, value =>
      readNumber(value, 'max_output_tokens', { integer: true, min: 1 })
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
    responseFormat: text.responseFormat,
    tools,
    toolChoice: readToolChoice(body.tool_choice, tools),
    reasoning,
    providerOptions: mergeProviderOptions(
      {
        openai: {
          parallelToolCalls,
          reasoningSummary,
          strictJsonSchema: text.strict,
          textVerbosity: text.verbosity,
          promptCacheKey: optional(body.prompt_cache_key, value =>
            readString(value, 'prompt_cache_key')
          ),
          safetyIdentifier: optional(body.safety_identifier, value =>
            readString(value, 'safety_identifier')
          ),
          user: optional(body.user, value => readString(value, 'user'))
        }
      },
      parallelToolCalls === false ? { anthropic: { disableParallelToolUse: true } } : undefined
    )
  };

  let metadata = optional(body.metadata, value => readObject(value, 'metadata'));

  return {
    dialect: 'open_responses',
    model,
    stream: optional(body.stream, value => readBoolean(value, 'stream')) ?? false,
    streamUsage: true,
    options,
    echo: Object.fromEntries(
      echoedFields.flatMap(field =>
        field == 'metadata'
          ? [[field, metadata ?? {}]]
          : body[field] === undefined
            ? []
            : [[field, body[field]]]
      )
    )
  };
};
