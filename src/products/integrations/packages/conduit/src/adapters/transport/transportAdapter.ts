export type MessageHandler = (data: Uint8Array) => Promise<void>;

export interface ITransportAdapter {
  publish(subject: string, data: Uint8Array): Promise<void>;

  request(subject: string, data: Uint8Array, timeout: number): Promise<Uint8Array>;

  subscribe(subject: string, handler: MessageHandler): Promise<string>;

  unsubscribe(subscriptionId: string): Promise<void>;

  close(): Promise<void>;
}
