export interface ConduitConfig {
  conduitId: string;

  receiver: ReceiverConfig;

  sender: SenderConfig;

  coordination: CoordinationConfig;

  transport: TransportConfig;
}

export interface ReceiverConfig {
  heartbeatInterval: number;

  heartbeatTtl: number;

  topicOwnershipTtl: number;

  ownershipRenewalInterval: number;

  messageCacheTtl: number;

  messageCacheSize: number;

  timeoutExtensionThreshold: number;

  maxProcessingMs: number;

  maxInFlight: number;

  handlerConcurrency: number;
}

export interface SenderConfig {
  defaultTimeout: number;

  maxRetries: number;

  retryBackoffMs: number;

  retryBackoffMultiplier: number;

  topicOwnershipTtl: number;

  inFlightCacheTtl: number;

  maxInFlightMessages: number;

  /**
   * Default timeout (ms) for a direct per-receiver health ping (`pingReceiver`).
   */
  healthPingTimeout: number;
}

export type CoordinationConfig = { type: 'redis'; redis: RedisConfig } | { type: 'memory' };

export interface RedisConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: {
    rejectUnauthorized?: boolean;
  };
}

export type TransportConfig = { type: 'nats'; nats: NatsConfig } | { type: 'memory' };

export interface NatsConfig {
  servers: string[];
  token?: string;
  user?: string;
  pass?: string;
}

export const DEFAULT_CONFIG: ConduitConfig = {
  conduitId: 'default',
  receiver: {
    heartbeatInterval: 5000,
    heartbeatTtl: 10000,
    topicOwnershipTtl: 30000,
    ownershipRenewalInterval: 10000, // Renew at TTL/3 for safety margin
    messageCacheTtl: 60000,
    messageCacheSize: 10000,
    timeoutExtensionThreshold: 1000,
    maxProcessingMs: 300000,
    maxInFlight: 2000,
    handlerConcurrency: 256
  },
  sender: {
    defaultTimeout: 5000,
    maxRetries: 2,
    retryBackoffMs: 50,
    retryBackoffMultiplier: 1.5,
    topicOwnershipTtl: 5000,
    inFlightCacheTtl: 60000,
    maxInFlightMessages: 1000,
    healthPingTimeout: 1500
  },
  coordination: {
    type: 'memory'
  },
  transport: {
    type: 'memory'
  }
};

export let mergeConfig = (userConfig: Partial<ConduitConfig>): ConduitConfig => {
  return {
    conduitId: userConfig.conduitId || DEFAULT_CONFIG.conduitId,
    receiver: { ...DEFAULT_CONFIG.receiver, ...userConfig.receiver },
    sender: { ...DEFAULT_CONFIG.sender, ...userConfig.sender },
    coordination: userConfig.coordination || DEFAULT_CONFIG.coordination,
    transport: userConfig.transport || DEFAULT_CONFIG.transport
  };
};
