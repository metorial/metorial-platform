export abstract class InterconnectChannelClient {
  abstract send(data: string): Promise<void>;
  abstract onMessage(callback: (data: string) => void): () => void;
  abstract onError(callback: (error: Error) => void): () => void;
  abstract onReady(callback: () => void): () => void;
  abstract onClose(callback: () => void): () => void;
  abstract close(): Promise<void>;
}

export abstract class InterconnectChannelServer {
  abstract handleConnection<T>(callback: (client: InterconnectChannelClient) => T): void;
}
