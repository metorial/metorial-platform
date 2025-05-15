import { MICMessage } from '../protocol/schema';

export abstract class MICTransceiver {
  constructor(public readonly info: { sessionId: string; connectionId: string }) {}

  abstract send(message: MICMessage): Promise<void>;

  abstract onMessage(
    callback: (data: MICMessage) => void,
    opts?: { once?: boolean }
  ): Promise<void>;

  abstract onClose(callback: () => void, opts?: { once?: boolean }): Promise<void>;

  abstract close(): Promise<void>;
}
