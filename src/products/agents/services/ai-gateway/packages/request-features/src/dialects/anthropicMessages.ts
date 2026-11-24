import {
  createSummaryBuilder,
  estimateTokens,
  type RequestSummary,
  type ResponseFormat,
  type SummaryBuilder
} from '../lib/summary';
import { asArray, asNumber, asRecord, asString, jsonLength } from '../lib/values';

type ReadBlocks = { texts: string[]; onlyToolResults: boolean };

let readBlocks = (builder: SummaryBuilder, content: unknown): ReadBlocks => {
  let text = asString(content);
  if (text !== undefined) {
    builder.inputChars += text.length;
    return { texts: [text], onlyToolResults: false };
  }

  let texts: string[] = [];
  let blocks = asArray(content);
  let toolResults = 0;

  for (let block of blocks) {
    let record = asRecord(block);
    let type = asString(record?.type);

    if (type == 'text') {
      let blockText = asString(record?.text) ?? '';
      builder.inputChars += blockText.length;
      texts.push(blockText);
    } else if (type == 'image') {
      builder.hasImages = true;
    } else if (type == 'document') {
      builder.hasFiles = true;
    } else if (type == 'tool_result') {
      toolResults++;
      builder.inputChars += jsonLength(record?.content);
      if (asArray(record?.content).some(item => asRecord(item)?.type == 'image')) {
        builder.hasImages = true;
      }
    } else if (type == 'tool_use') {
      builder.inputChars += jsonLength(record?.input);
    }
  }

  return { texts, onlyToolResults: blocks.length > 0 && toolResults == blocks.length };
};

let responseFormatOf = (body: Record<string, unknown>): ResponseFormat => {
  let format = asRecord(asRecord(body.output_config)?.format) ?? asRecord(body.output_format);

  return asString(format?.type) == 'json_schema' ? 'json_schema' : 'text';
};

let isToolChoiceRequired = (toolChoice: unknown) => {
  let type = asString(asRecord(toolChoice)?.type);
  return type == 'any' || type == 'tool';
};

export let summarizeAnthropicMessages = (body: Record<string, unknown>): RequestSummary => {
  let builder = createSummaryBuilder();
  let messages = asArray(body.messages);

  builder.systemTexts.push(...readBlocks(builder, body.system).texts);

  let lastOnlyToolResults = false;

  for (let message of messages) {
    let record = asRecord(message);
    if (!record) continue;

    builder.messageCount++;

    let role = asString(record.role);
    let read = readBlocks(builder, record.content);

    if (role == 'user' && read.texts.some(text => text.trim())) {
      builder.userTexts.push(read.texts.join('\n'));
    }

    lastOnlyToolResults = role == 'user' && read.onlyToolResults;
  }

  builder.isContinuation = lastOnlyToolResults;

  let tools = asArray(body.tools);
  let toolNames = tools.flatMap(tool => {
    let name = asString(asRecord(tool)?.name);
    return name ? [name] : [];
  });
  builder.inputChars += jsonLength(body.tools);

  return {
    dialect: 'anthropic_messages',
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
    maxOutputTokens: asNumber(body.max_tokens) ?? null,
    temperature: asNumber(body.temperature) ?? null,
    reasoningEffort: asString(asRecord(body.output_config)?.effort) ?? null,

    inputChars: builder.inputChars,
    estimatedInputTokens: estimateTokens(builder.inputChars),

    systemText: builder.systemTexts.join('\n'),
    userTexts: builder.userTexts
  };
};
