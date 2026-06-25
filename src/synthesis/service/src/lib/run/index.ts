import type { FilePart, ModelMessage, TextPart } from 'ai';
import type {
  Assistant,
  AssistantConversation,
  AssistantImplementation,
  Environment,
  Tenant
} from '../../db';
import { summaryModel } from '../../definitions/models/_util';
import type { InputMessage, State } from '../../types';
import type { Implementation, Model } from '../definitions';
import { getConversationHistory } from '../history/getHistory';
import { Agent, DefaultCompactionStrategy, Session } from '../open-harness';
import type { AgentRunResult, AgentRunStateOptions, AgentRunWireMessage } from './state';
import { AgentRunState } from './state';

export * from './state';

export type AgentRunOptions = AgentRunStateOptions & {
  onSnapshot?: (snapshot: AgentRunWireMessage) => void | Promise<void>;
  snapshotIntervalMs?: number;
};

let deserializeMessages = (
  serialized: PrismaJson.AssistantMessageSerializedContent
): ModelMessage[] =>
  serialized.messages
    .map(([ts, msg]) => ({ ts, msg }))
    .sort((a, b) => a.ts - b.ts)
    .map(m => m.msg as ModelMessage);

let inputMessageToModelMessages = (input: InputMessage): ModelMessage[] => [
  {
    role: 'user',
    content: input.parts.map(p => {
      if (p.type === 'text') {
        return {
          type: 'text' as const,
          text: p.text
        } satisfies TextPart;
      }

      if (p.type === 'file') {
        return {
          type: 'file' as const,
          filename: p.filename,
          mediaType: p.mediaType,
          data: Buffer.from(p.data, p.encoding)
        } satisfies FilePart;
      }

      throw new Error(`Unsupported part type: ${JSON.stringify(p)}`);
    })
  }
];

let handoffResponsesToModelMessages = (
  responses: Array<{ toolCallId: string; toolName: string; output: unknown }>
): ModelMessage[] => [
  {
    role: 'tool',
    content: responses.map(response => ({
      type: 'tool-result',
      toolCallId: response.toolCallId,
      toolName: response.toolName,
      output: response.output
    }))
  } as ModelMessage
];

export class AgentRun {
  abortController = new AbortController();

  constructor(
    private readonly agent: Agent,
    private readonly model: Model,
    private readonly tenant: Tenant,
    private readonly environment: Environment,
    private readonly assistant: Assistant,
    private readonly assistantImplementation: AssistantImplementation,
    private readonly implementation: Implementation
  ) {}

  private async createSession() {
    return new Session({
      agent: this.agent,
      autoCompact: true,
      contextWindow: Math.ceil(this.model.contextWindow * 0.9),
      reservedTokens: 20_000,
      compactionStrategy: new DefaultCompactionStrategy({
        protectedTokens: 20_000,
        minPruneSavings: 10_000,
        summaryModel: (await summaryModel).model
      }),
      retry: { maxRetries: 5 }
    });
  }

  private async runSession(d: {
    session: Session;
    input: ModelMessage[];
    initialState?: State;
    delta?: AgentRunOptions;
  }) {
    let iterator = d.session.send(d.input, { signal: this.abortController.signal });

    let runState = new AgentRunState(d.session.messages, d.delta, d.initialState);
    let snapshotInterval: ReturnType<typeof setInterval> | undefined;
    let snapshotInFlight = false;
    let writeSnapshot = async () => {
      if (!d.delta?.onSnapshot || snapshotInFlight) return;

      snapshotInFlight = true;
      try {
        await d.delta.onSnapshot(runState.getSnapshot());
      } finally {
        snapshotInFlight = false;
      }
    };

    if (d.delta?.onSnapshot) {
      snapshotInterval = setInterval(
        () => void writeSnapshot(),
        d.delta.snapshotIntervalMs ?? 500
      );
    }

    try {
      for await (let event of iterator) {
        runState.pipe(event);
      }

      return runState.result();
    } catch (error) {
      runState.pipe({
        type: 'error',
        error
      } as any);
      throw error;
    } finally {
      if (snapshotInterval) clearInterval(snapshotInterval);
      await writeSnapshot();
    }
  }

  async run(d: {
    input: InputMessage;
    conversation: AssistantConversation;
    lastMessageId: string;
    historySize: number;
    delta?: AgentRunOptions;
  }): Promise<AgentRunResult> {
    let session = await this.createSession();
    let history = await getConversationHistory({
      conversation: d.conversation,
      lastMessageId: d.lastMessageId,
      size: d.historySize
    });

    session.messages.push(...history.flatMap(m => deserializeMessages(m.serialized)));

    return await this.runSession({
      session,
      input: inputMessageToModelMessages(d.input),
      delta: d.delta
    });
  }

  async resume(d: {
    serialized: PrismaJson.AssistantMessageSerializedContent;
    state: State;
    responses: Array<{ toolCallId: string; toolName: string; output: unknown }>;
    delta?: AgentRunOptions;
  }): Promise<AgentRunResult> {
    let session = await this.createSession();
    session.messages.push(...deserializeMessages(d.serialized));

    return await this.runSession({
      session,
      input: handoffResponsesToModelMessages(d.responses),
      initialState: d.state,
      delta: d.delta
    });
  }
}
