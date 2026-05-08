import { Assistant, AssistantConversation, Instance, Organization } from '@metorial/db';
import { Agent, DefaultCompactionStrategy, Session } from '@openharness/core';
import { FilePart, TextPart } from 'ai';
import { summaryModel } from '../../definitions/models';
import { InputMessage } from '../../proto/types';
import { getConversationHistory } from '../history/getHistory';
import { Implementation, Model } from '../definitions';
import {
  AgentRunResult,
  AgentRunState,
  AgentRunStateOptions,
  AgentRunWireMessage
} from './state';

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
    private readonly instance: Instance,
    private readonly organization: Organization,
    private readonly assistant: Assistant,
    private readonly assistantImplementation: Implementation
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
        .map(m => m.msg)
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

            // @ts-expect-error exhaustive check
            throw new Error(`Unsupported part type: ${p.type}`);
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
