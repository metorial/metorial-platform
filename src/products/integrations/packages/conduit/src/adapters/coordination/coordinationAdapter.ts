export interface ICoordinationAdapter {
  registerReceiver(receiverId: string, ttl: number): Promise<void>;
  unregisterReceiver(receiverId: string): Promise<void>;
  getActiveReceivers(): Promise<string[]>;
  claimTopicOwnership(topic: string, receiverId: string, ttl: number): Promise<boolean>;
  getTopicOwner(topic: string): Promise<string | null>;
  releaseTopicOwnership(topic: string, receiverId: string): Promise<void>;
  renewTopicOwnership(topic: string, receiverId: string, ttl: number): Promise<boolean>;
  close(): Promise<void>;
}
