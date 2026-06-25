# `@lowerdeck/redis`

Redis client utilities with automatic reconnection, lazy initialization, and Redis Streams support. Simplifies Redis connection management with exponential backoff and error handling.

## Installation

```bash
npm install @lowerdeck/redis
yarn add @lowerdeck/redis
bun add @lowerdeck/redis
pnpm add @lowerdeck/redis
```

## Usage

```typescript
import { createRedisClient, RedisStreams, parseRedisUrl } from '@lowerdeck/redis';

// Create a Redis client with automatic reconnection
const client = createRedisClient({
  redisUrl: 'redis://localhost:6379'
});

// Connect eagerly
const redis = await client.eager();
await redis.set('key', 'value');

// Or use lazy connection (connects on first use)
const lazyRedis = client.lazy();
await lazyRedis().set('key', 'value');

// Parse Redis URLs
const config = parseRedisUrl('redis://user:pass@localhost:6379/2');
// => { host: 'localhost', port: 6379, password: 'pass', db: 2, tls: false }

// Use Redis Streams for event messaging
const streams = new RedisStreams<{ userId: string; action: string }>(
  'user-events',
  'redis://localhost:6379'
);

// Send messages to the stream
await streams.send({
  userId: '123',
  action: 'login'
});

// Create a consumer to process messages
await streams.createReceiver(
  {
    groupId: 'user-event-processors',
    consumerId: 'worker-1',
    concurrency: 10
  },
  async (message) => {
    console.log('Processing event:', message);
    await handleUserEvent(message);
  }
);

// Multiple consumers can process the same stream
await streams.createReceiver(
  {
    groupId: 'analytics-processors',
    consumerId: 'analytics-worker'
  },
  async (message) => {
    await trackAnalytics(message);
  }
);
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
