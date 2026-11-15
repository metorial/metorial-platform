import type { ModelMessage } from 'ai';
import type { SessionEvent, SessionStore } from '../session';
import type { Runner } from './runner';

export interface ConversationOptions {
  runner: Runner;
  sessionId?: string;
  store?: SessionStore;
}

/**
 * Thin stateful wrapper over a composed Runner.
 * Manages `messages` — updates from `done` events.
 * No compaction/retry/hooks/turn logic — those are middleware concerns.
 */
export class Conversation {
  messages: ModelMessage[] = [];
  readonly sessionId: string;

  private runner: Runner;
  private store?: SessionStore;

  constructor(options: ConversationOptions) {
    this.runner = options.runner;
    this.sessionId = options.sessionId ?? crypto.randomUUID();
    this.store = options.store;
  }

  /**
   * Send a message through the composed runner pipeline.
   * Updates `this.messages` from `done` events automatically.
   */
  async *send(
    input: string | ModelMessage[],
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<SessionEvent> {
    for await (const event of this.runner(
      this.messages,
      input,
      options
    ) as AsyncGenerator<SessionEvent>) {
      if (event.type === 'done') {
        this.messages = event.messages;
      }
      yield event;
    }
  }

  /** Load messages from store. */
  async load(): Promise<boolean> {
    if (!this.store) return false;
    const loaded = await this.store.load(this.sessionId);
    if (loaded) {
      this.messages = loaded;
      return true;
    }
    return false;
  }

  /** Save messages to store. */
  async save(): Promise<void> {
    if (!this.store) return;
    await this.store.save(this.sessionId, this.messages);
  }
}
