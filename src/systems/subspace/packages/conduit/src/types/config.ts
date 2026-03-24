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
}

export interface SenderConfig {
  defaultTimeout: number;

  maxRetries: number;

  retryBackoffMs: number;

  retryBackoffMultiplier: number;

  inFlightCacheTtl: number;

  maxInFlightMessages: number;
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
    timeoutExtensionThreshold: 1000
  },
  sender: {
    defaultTimeout: 5000,
    maxRetries: 3,
    retryBackoffMs: 100,
    retryBackoffMultiplier: 2,
    inFlightCacheTtl: 60000,
    maxInFlightMessages: 1000
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
