import type { FilePart, ModelMessage, TextPart } from 'ai';
import type {
  Assistant,
  AssistantConversation,
  AssistantImplementation,
  Environment,
  Tenant
} from '../../db';
import { summaryModel } from '../../definitions/models/_util';
import type { InputMessage } from '../../types';
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

    session.messages.push(
      ...history
        .flatMap(m => m.serialized.messages)
        .map(([ts, msg]) => ({ ts, msg }))
        .sort((a, b) => a.ts - b.ts)
        .map(m => m.msg as ModelMessage)
    );

    let iterator = session.send(
      [
        {
          role: 'user',
          content: d.input.parts.map(p => {
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
      ],
      { signal: this.abortController.signal }
    );

    let runState = new AgentRunState(session.messages, d.delta);
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
}
