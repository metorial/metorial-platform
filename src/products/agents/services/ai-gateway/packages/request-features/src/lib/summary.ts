export type RequestDialect = 'openai_chat' | 'anthropic_messages' | 'open_responses';

export type ResponseFormat = 'text' | 'json_object' | 'json_schema';

export type RequestSummary = {
  dialect: RequestDialect;
  stream: boolean;

  messageCount: number;
  userTurns: number;
  isContinuation: boolean;

  hasImages: boolean;
  hasFiles: boolean;
  hasAudio: boolean;

  toolCount: number;
  toolNames: string[];
  toolChoiceRequired: boolean;

  responseFormat: ResponseFormat;
  maxOutputTokens: number | null;
  temperature: number | null;
  reasoningEffort: string | null;

  inputChars: number;
  estimatedInputTokens: number;

  systemText: string;
  userTexts: string[];
};

let charsPerToken = 4;

export let estimateTokens = (chars: number) => Math.ceil(chars / charsPerToken);

export type SummaryBuilder = {
  messageCount: number;
  systemTexts: string[];
  userTexts: string[];
  inputChars: number;
  hasImages: boolean;
  hasFiles: boolean;
  hasAudio: boolean;
  isContinuation: boolean;
};

export let createSummaryBuilder = (): SummaryBuilder => ({
  messageCount: 0,
  systemTexts: [],
  userTexts: [],
  inputChars: 0,
  hasImages: false,
  hasFiles: false,
  hasAudio: false,
  isContinuation: false
});

export let lastUserText = (summary: Pick<RequestSummary, 'userTexts'>) =>
  summary.userTexts[summary.userTexts.length - 1] ?? '';
