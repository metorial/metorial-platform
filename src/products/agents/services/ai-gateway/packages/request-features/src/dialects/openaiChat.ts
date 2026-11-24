import {
  createSummaryBuilder,
  estimateTokens,
  type RequestSummary,
  type ResponseFormat,
  type SummaryBuilder
} from '../lib/summary';
import { asArray, asNumber, asRecord, asString, jsonLength } from '../lib/values';

let readContent = (builder: SummaryBuilder, content: unknown) => {
  let text = asString(content);
  if (text !== undefined) {
    builder.inputChars += text.length;
    return [text];
  }

  let texts: string[] = [];

  for (let part of asArray(content)) {
    let record = asRecord(part);
    let type = asString(record?.type);

    if (type == 'text') {
      let partText = asString(record?.text) ?? '';
      builder.inputChars += partText.length;
      texts.push(partText);
    } else if (type == 'image_url') {
      builder.hasImages = true;
    } else if (type == 'input_audio') {
      builder.hasAudio = true;
    } else if (type == 'file') {
      builder.hasFiles = true;
    }
  }

  return texts;
};

let responseFormatOf = (body: Record<string, unknown>): ResponseFormat => {
  let type = asString(asRecord(body.response_format)?.type);

  return type == 'json_object' || type == 'json_schema' ? type : 'text';
};

let isToolChoiceRequired = (toolChoice: unknown) =>
  toolChoice == 'required' || asString(asRecord(toolChoice)?.type) == 'function';

export let summarizeOpenaiChat = (body: Record<string, unknown>): RequestSummary => {
  let builder = createSummaryBuilder();
  let messages = asArray(body.messages);

  for (let message of messages) {
    let record = asRecord(message);
    if (!record) continue;

    builder.messageCount++;

    let role = asString(record.role);
    let texts = readContent(builder, record.content);

    if (role == 'system' || role == 'developer') builder.systemTexts.push(...texts);
    if (role == 'user' && texts.some(text => text.trim()))
      builder.userTexts.push(texts.join('\n'));
    if (role == 'assistant') builder.inputChars += jsonLength(record.tool_calls);
  }

  let last = asRecord(messages[messages.length - 1]);
  builder.isContinuation = asString(last?.role) == 'tool';

  let tools = asArray(body.tools);
  let toolNames = tools.flatMap(tool => {
    let name = asString(asRecord(asRecord(tool)?.function)?.name);
    return name ? [name] : [];
  });
  builder.inputChars += jsonLength(body.tools);

  return {
    dialect: 'openai_chat',
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
    maxOutputTokens: asNumber(body.max_completion_tokens) ?? asNumber(body.max_tokens) ?? null,
    temperature: asNumber(body.temperature) ?? null,
    reasoningEffort: asString(body.reasoning_effort) ?? null,

    inputChars: builder.inputChars,
    estimatedInputTokens: estimateTokens(builder.inputChars),

    systemText: builder.systemTexts.join('\n'),
    userTexts: builder.userTexts
  };
};
