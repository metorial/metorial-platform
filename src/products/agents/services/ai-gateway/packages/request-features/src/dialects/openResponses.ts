import {
  createSummaryBuilder,
  estimateTokens,
  type RequestSummary,
  type ResponseFormat,
  type SummaryBuilder
} from '../lib/summary';
import { asArray, asNumber, asRecord, asString, jsonLength } from '../lib/values';

let textPartTypes = new Set(['input_text', 'output_text', 'text']);

let readContent = (builder: SummaryBuilder, content: unknown) => {
  let text = asString(content);
  if (text !== undefined) {
    builder.inputChars += text.length;
    return [text];
  }

  let texts: string[] = [];

  for (let part of asArray(content)) {
    let record = asRecord(part);
    let type = asString(record?.type) ?? '';

    if (textPartTypes.has(type)) {
      let partText = asString(record?.text) ?? '';
      builder.inputChars += partText.length;
      texts.push(partText);
    } else if (type == 'input_image') {
      builder.hasImages = true;
    } else if (type == 'input_file') {
      builder.hasFiles = true;
    } else if (type == 'input_audio') {
      builder.hasAudio = true;
    }
  }

  return texts;
};

let responseFormatOf = (body: Record<string, unknown>): ResponseFormat => {
  let type = asString(asRecord(asRecord(body.text)?.format)?.type);

  return type == 'json_object' || type == 'json_schema' ? type : 'text';
};

let isToolChoiceRequired = (toolChoice: unknown) => {
  if (toolChoice == 'required') return true;

  let record = asRecord(toolChoice);
  if (!record) return false;

  return asString(record.type) == 'allowed_tools'
    ? asString(record.mode) == 'required'
    : asString(record.type) != undefined;
};

export let summarizeOpenResponses = (body: Record<string, unknown>): RequestSummary => {
  let builder = createSummaryBuilder();

  let instructions = asString(body.instructions);
  if (instructions) {
    builder.systemTexts.push(instructions);
    builder.inputChars += instructions.length;
  }

  let input =
    asString(body.input) !== undefined
      ? [{ role: 'user', content: body.input }]
      : asArray(body.input);

  for (let item of input) {
    let record = asRecord(item);
    if (!record) continue;

    builder.messageCount++;

    let type = asString(record.type) ?? 'message';

    if (type == 'message') {
      let role = asString(record.role);
      let texts = readContent(builder, record.content);

      if (role == 'system' || role == 'developer') builder.systemTexts.push(...texts);
      if (role == 'user' && texts.some(text => text.trim())) {
        builder.userTexts.push(texts.join('\n'));
      }
    } else if (type == 'function_call') {
      builder.inputChars += jsonLength(record.arguments);
    } else if (type == 'function_call_output') {
      builder.inputChars += jsonLength(record.output);
    }
  }

  let last = asRecord(input[input.length - 1]);
  builder.isContinuation = asString(last?.type) == 'function_call_output';

  let tools = asArray(body.tools);
  let toolNames = tools.flatMap(tool => {
    let record = asRecord(tool);
    let name = asString(record?.name) ?? asString(record?.type);
    return name ? [name] : [];
  });
  builder.inputChars += jsonLength(body.tools);

  return {
    dialect: 'open_responses',
    stream: body.stream === true,

    messageCount: builder.messageCount,
    userTurns: builder.userTexts.length,
    isContinuation: builder.isContinuation,

    hasImages: builder.hasImages,
    hasFiles: builder.hasFiles,
    hasAudio: builder.hasAudio,

    toolCount: tools.length,
    toolNames,
    toolChoiceRequired: isToolChoiceRequired(body.tool_choice),

    responseFormat: responseFormatOf(body),
    maxOutputTokens: asNumber(body.max_output_tokens) ?? null,
    temperature: asNumber(body.temperature) ?? null,
    reasoningEffort: asString(asRecord(body.reasoning)?.effort) ?? null,

    inputChars: builder.inputChars,
    estimatedInputTokens: estimateTokens(builder.inputChars),

    systemText: builder.systemTexts.join('\n'),
    userTexts: builder.userTexts
  };
};
