import type { LanguageModel } from 'ai';
import type { MockLanguageModelV4 } from 'ai/test';

export let e2eModelDirectives = {
  error: '[e2e:error]',
  tool: '[e2e:tool]',
  slow: '[e2e:slow]'
};

export let e2eModelFailureMessage = 'E2E mock model failure';
export let e2eToolOutput = 'e2e-tool-output';
export let e2eSlowChunkDelayMs = 400;

export let e2eModelUsage = {
  inputTokens: 100,
  outputTokens: 7
};

type CallOptions = Parameters<MockLanguageModelV4['doStream']>[0];
type Prompt = CallOptions['prompt'];
type StreamResult = Awaited<ReturnType<MockLanguageModelV4['doStream']>>;
type StreamPart = StreamResult['stream'] extends ReadableStream<infer T> ? T : never;

export let isE2EModelEnabled = () =>
  process.env.CONTROL_E2E === '1' && process.env.NODE_ENV !== 'production';

let usage = {
  inputTokens: {
    total: e2eModelUsage.inputTokens,
    noCache: e2eModelUsage.inputTokens,
    cacheRead: 0,
    cacheWrite: 0
  },
  outputTokens: {
    total: e2eModelUsage.outputTokens,
    text: e2eModelUsage.outputTokens,
    reasoning: 0
  }
};

let textOf = (content: unknown): string => {
  if (typeof content == 'string') return content;
  if (!Array.isArray(content)) return '';

  return content.map(part => (part?.type == 'text' ? part.text : '')).join('');
};

let userTexts = (prompt: Prompt) =>
  prompt
    .filter(message => message.role == 'user')
    .map(message => textOf(message.content).trim());

let toolStdout = (content: unknown) => {
  let result = Array.isArray(content)
    ? content.find(part => part?.type == 'tool-result')
    : undefined;
  let stdout = result?.output?.value?.stdout;

  return typeof stdout == 'string' ? stdout.trim() : JSON.stringify(result?.output ?? null);
};

let textParts = (text: string): StreamPart[] => [
  { type: 'text-start', id: 'text' },
  ...text.split(/(?<=\s)/).map(delta => ({ type: 'text-delta' as const, id: 'text', delta })),
  { type: 'text-end', id: 'text' }
];

export let createE2EModel = async (slug: string): Promise<LanguageModel> => {
  let { MockLanguageModelV4, simulateReadableStream } = await import('ai/test');
  let toolCallCount = 0;

  let stream = (
    parts: StreamPart[],
    finishReason: 'stop' | 'tool-calls',
    chunkDelayInMs: number | null = null
  ): StreamResult => ({
    stream: simulateReadableStream<StreamPart>({
      chunks: [
        { type: 'stream-start', warnings: [] },
        ...parts,
        { type: 'finish', usage, finishReason: { unified: finishReason, raw: finishReason } }
      ],
      chunkDelayInMs
    })
  });

  return new MockLanguageModelV4({
    provider: 'metorial-e2e',
    modelId: slug,

    doStream: async options => {
      let texts = userTexts(options.prompt);
      let lastUserText = texts.at(-1) ?? '';
      let lastMessage = options.prompt.at(-1);

      if (lastUserText.includes(e2eModelDirectives.error)) {
        throw new Error(e2eModelFailureMessage);
      }

      if (lastMessage?.role == 'tool') {
        return stream(textParts(`Tool finished: ${toolStdout(lastMessage.content)}`), 'stop');
      }

      if (lastUserText.includes(e2eModelDirectives.tool)) {
        toolCallCount++;

        return stream(
          [
            {
              type: 'tool-call',
              toolCallId: `e2e-call-${toolCallCount}`,
              toolName: 'bash',
              input: JSON.stringify({ command: `echo ${e2eToolOutput}` })
            }
          ],
          'tool-calls'
        );
      }

      let reply = `Echo from ${slug}: ${lastUserText}\nHistory: ${texts.join(' > ')}`;
      let slow = lastUserText.includes(e2eModelDirectives.slow);

      return stream(textParts(reply), 'stop', slow ? e2eSlowChunkDelayMs : null);
    },

    doGenerate: async options => {
      let system = textOf(options.prompt.find(message => message.role == 'system')?.content);
      let lastLine = (userTexts(options.prompt).at(-1) ?? '').split('\n').at(-1)?.trim();
      let text = system.includes('conversation titles')
        ? `E2E title: ${lastLine}`
        : 'E2E summary';

      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage,
        warnings: []
      };
    }
  });
};
