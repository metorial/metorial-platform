export interface ConduitResponse {
  messageId: string;

  success: boolean;

  result?: unknown;

  error?: string;

  processedAt: number;
}

export class ConduitSendError extends Error {
  public readonly messageId: string;
  public readonly topic: string;
  public readonly retryCount: number;
  public readonly originalError?: Error;

  constructor(
    message: string,
    messageId: string,
    topic: string,
    retryCount: number,
    cause?: Error
  ) {
    super(message);
    this.name = 'ConduitSendError';
    this.messageId = messageId;
    this.topic = topic;
    this.retryCount = retryCount;
    this.originalError = cause;
  }
}

export class ConduitProcessError extends Error {
  public readonly messageId: string;
  public readonly topic: string;
  public readonly originalError?: Error;

  constructor(message: string, messageId: string, topic: string, cause?: Error) {
    super(message);
    this.name = 'ConduitProcessError';
    this.messageId = messageId;
    this.topic = topic;
    this.originalError = cause;
  }
}
