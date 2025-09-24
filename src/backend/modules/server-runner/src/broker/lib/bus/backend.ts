import type { ServerSession } from '@metorial/db';
import { createRedisClient } from '@metorial/redis';
import mitt from 'mitt';
import type Redis from 'redis';

let redisPromise = createRedisClient({}).eager();

export type BrokerBusBackendEvents = {
  client_close: void;

  server_open: void;
  server_close: void;
  server_error: {
    message: string;
  };

  stop: void;

  client_mcp_message: void;
  server_mcp_message: void;
};

let getSessionEventsKey = (sessionId: string) => `mtg/ose/m1:${sessionId}`;

export class BrokerBusBackend {
  #emitter = mitt<BrokerBusBackendEvents>();
  #subRedis: Redis.RedisClientType | null = null;

  private constructor(private session: ServerSession) {}

  static async create(session: ServerSession, opts: { subscribe: boolean }) {
    let bus = new BrokerBusBackend(session);
    if (opts.subscribe) await bus.connect();
    return bus;
  }

  #closing = false;
  close() {
    if (this.#closing) return;
    this.#closing = true;

    if (this.#subRedis) {
      this.#subRedis.quit();
      this.#subRedis = null;
    }

    this.#emitter.all.clear();
  }

  on<T extends keyof BrokerBusBackendEvents>(
    type: T,
    handler: (payload: BrokerBusBackendEvents[T]) => void
  ) {
    this.#emitter.on(type, handler);

    return () => {
      this.#emitter.off(type, handler);
    };
  }

  async emit<T extends keyof BrokerBusBackendEvents>(
    ...[type, payload]: BrokerBusBackendEvents[T] extends void
      ? [T]
      : [T, BrokerBusBackendEvents[T]]
  ) {
    let redis = await redisPromise;

    await redis.publish(getSessionEventsKey(this.session.id), JSON.stringify([type, payload]));
  }

  private async connect() {
    try {
      let redis = await redisPromise;

      this.#subRedis = redis.duplicate() as any as Redis.RedisClientType;
      await this.#subRedis.connect();

      await this.#subRedis.subscribe(getSessionEventsKey(this.session.id), async message => {
        let [type, payload] = JSON.parse(message) as [keyof BrokerBusBackendEvents, any];
        this.#emitter.emit(type, payload);
      });
    } catch (error) {
      console.error('Error connecting to Redis:', error);
      this.#subRedis = null;
    }
  }
}
