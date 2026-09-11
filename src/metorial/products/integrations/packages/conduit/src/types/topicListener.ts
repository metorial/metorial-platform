import type { ConduitResponse } from './response';

export interface TopicResponseBroadcast {
  topic: string;

  messageId: string;

  response: ConduitResponse;

  receiverId: string;

  broadcastAt: number;
}

export type TopicListener = (broadcast: TopicResponseBroadcast) => void | Promise<void>;

export interface TopicSubscription {
  topic: string;

  unsubscribe(): Promise<void>;
}
