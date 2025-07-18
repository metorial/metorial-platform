import type { ServerSession } from '@metorial/db';
import type { JSONRPCMessage } from '@metorial/mcp-utils';
import { createRedisClient } from '@metorial/redis';
import mitt from 'mitt';
import Redis from 'redis';
import { ConnectionMessage } from './handler/base';

let redisPromise = createRedisClient({
  url: process.env.REDIS_URL
}).eager();

export type SessionControlMessageBackendEvents = {
  message: ConnectionMessage;
  close: void;
};

let getSessionControlEventsKey = (sessionId: string) => `mtg/ose/c1:${sessionId}`;

export class SessionControlMessageBackend {
  #emitter = mitt<SessionControlMessageBackendEvents>();
  #subRedis: Redis.RedisClientType | null = null;

  constructor(
    private session: ServerSession,
    opts: { mode: 'send-only' | 'send-and-receive' }
  ) {
    if (opts.mode == 'send-and-receive') this.connect();
  }

  #closing = false;
  async close() {
    if (this.#closing) return;
    this.#closing = true;

    this.#emitter.emit('close', undefined);

    if (this.#subRedis) {
      this.#subRedis.quit();
      this.#subRedis = null;
    }

    this.#emitter.all.clear();
  }

  on<T extends keyof SessionControlMessageBackendEvents>(
    type: T,
    handler: (payload: SessionControlMessageBackendEvents[T]) => void
  ) {
    this.#emitter.on(type, handler);

    return () => {
      this.#emitter.off(type, handler);
    };
  }

  async emit<T extends keyof SessionControlMessageBackendEvents>(
    ...[type, payload]: SessionControlMessageBackendEvents[T] extends void
      ? [T]
      : [T, SessionControlMessageBackendEvents[T]]
  ) {
    let redis = await redisPromise;

    await redis.publish(
      getSessionControlEventsKey(this.session.id),
      JSON.stringify([type, payload])
    );
  }

  sendMessage(message: JSONRPCMessage) {
    this.emit('message', {
      message
    });
  }

  onMessage(handler: (message: ConnectionMessage) => void) {
    this.#emitter.on('message', handler);
    return () => this.#emitter.off('message', handler);
  }

  onClose(handler: () => void) {
    this.#emitter.on('close', handler);
    return () => this.#emitter.off('close', handler);
  }

  private async connect() {
    try {
      let redis = await redisPromise;

      this.#subRedis = redis.duplicate() as any as Redis.RedisClientType;
      await this.#subRedis.connect();

      await this.#subRedis.subscribe(
        getSessionControlEventsKey(this.session.id),
        async message => {
          let [type, payload] = JSON.parse(message) as [
            keyof SessionControlMessageBackendEvents,
            any
          ];
          this.#emitter.emit(type, payload);
        }
      );
    } catch (error) {
      console.error('Error connecting to Redis:', error);
      this.#subRedis = null;
    }
  }
}
