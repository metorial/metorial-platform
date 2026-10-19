export interface ConduitResponse {
  messageId: string;

  success: boolean;

  result?: unknown;

  error?: string;

  // Set when the message never reached a handler, so the sender may safely redeliver it.
  retryable?: boolean;

  processedAt: number;
}

export class ConduitTopicClosedError extends Error {
  constructor(public readonly topic: string) {
    super(`Topic ${topic} has been closed`);
    this.name = 'ConduitTopicClosedError';
  }
}

export class ConduitSendError extends Error {
  public readonly messageId: string;
  public readonly topic: string;
  public readonly retryCount: number;
  public readonly originalError?: Error;
  public readonly retryable: boolean;

  constructor(
    message: string,
    messageId: string,
    topic: string,
    retryCount: number,
    cause?: Error,
    retryable: boolean = true
  ) {
    super(message);
    this.name = 'ConduitSendError';
    this.messageId = messageId;
    this.topic = topic;
    this.retryCount = retryCount;
    this.originalError = cause;
    this.retryable = retryable;
  }
}

export class ConduitReceiverUnavailableError extends ConduitSendError {
  constructor(
    messageId: string,
    topic: string,
    retryCount: number,
    public readonly elapsedMs: number,
    public readonly activeReceiverCount: number
  ) {
    super(
      `Receiver unavailable for topic ${topic} after ${elapsedMs}ms (activeReceivers=${activeReceiverCount})`,
      messageId,
      topic,
      retryCount
    );
    this.name = 'ConduitReceiverUnavailableError';
  }
}

export class ConduitPickupTimeoutError extends ConduitSendError {
  constructor(
    messageId: string,
    topic: string,
    retryCount: number,
    public readonly receiverId: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Request timeout before receiver pickup (${timeoutMs}ms)`,
      messageId,
      topic,
      retryCount
    );
    this.name = 'ConduitPickupTimeoutError';
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
