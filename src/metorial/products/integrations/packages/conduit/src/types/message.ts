export interface ConduitMessage {
  messageId: string;
  topic: string;
  payload: unknown;
  replySubject: string;
  timeout: number;
  sentAt: number;
  retryCount: number;
}

export interface TimeoutExtension {
  messageId: string;
  extensionMs: number;
  type: 'timeout_extension';
}

export let isTimeoutExtension = (msg: unknown): msg is TimeoutExtension => {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    msg.type === 'timeout_extension' &&
    'messageId' in msg &&
    'extensionMs' in msg
  );
};
