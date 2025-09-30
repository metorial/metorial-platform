import { Emitter } from '@metorial/emitter';
import { createLock } from '@metorial/lock';
import { createRedisClient } from '@metorial/redis';
import Redis from 'redis';

let redisPromise = createRedisClient({}).eager();

let sessionLock = createLock({ name: 'mic/ses' });

let keys = {
  session: (sessionId: string) => `mic:ses:${sessionId}`,
  sessionMembers: (sessionId: string) => `mic:ses:${sessionId}:members`,
  message: (sessionId: string) => `mic:msg:${sessionId}`
};

export interface MICBusEvents {
  message: { connectionId: string; isSelf?: boolean; payload: any };
  duplicate_close: { connectionId: string; except: string };
  close: void;
}

export class MICBus {
  #emitter = new Emitter<MICBusEvents>();
  #subRedis: Redis.RedisClientType | null = null;
  #initPromise: Promise<void> | null = null;
  #sessionStartedAt: number | null = null;
  #sessionUpdateIv: NodeJS.Timer | null = null;
  #internalId: string;

  constructor(private info: { sessionId: string; connectionId: string }) {
    this.#internalId = Math.random().toString(16).slice(2);
    this.#initPromise = this.init();

    this.#emitter.on('duplicate_close', data => {
      this.close({ isDuplicateClose: true });
    });
  }

  private async init() {
    let redis = await redisPromise;

    await sessionLock.usingLock(this.info.sessionId, async () => {
      let currentStr = await redis.get(keys.session(this.info.sessionId));
      let currentData: { start: number } | null = currentStr ? JSON.parse(currentStr) : null;

      this.#sessionStartedAt = currentData?.start ?? Date.now();

      let existingMembers = await redis.sMembers(keys.sessionMembers(this.info.sessionId));
      if (existingMembers.includes(this.info.connectionId)) {
        this.sendInternal('duplicate_close', {
          except: this.#internalId,
          connectionId: this.info.connectionId
        });
      }

      await redis.set(
        keys.session(this.info.sessionId),
        JSON.stringify({
          start: this.#sessionStartedAt
        }),
        { EX: 60 * 10 }
      );

      await redis.sAdd(keys.sessionMembers(this.info.sessionId), this.info.connectionId);
    });

    this.#subRedis = redis.duplicate() as Redis.RedisClientType;
    await this.#subRedis.connect();

    await this.#subRedis.subscribe(keys.session(this.info.sessionId), async message => {
      let [type, payload] = JSON.parse(message) as [keyof MICBusEvents, any];

      if (type === 'message') {
        let data = payload as MICBusEvents['message'];
        if (data.connectionId != this.info.connectionId && !data.isSelf) {
          this.#emitter.emit(type, data);
        } else if (data.isSelf) {
          this.#emitter.emit(type, data);
        }
      } else if (type === 'duplicate_close') {
        let data = payload as MICBusEvents['duplicate_close'];
        if (data.connectionId == this.info.connectionId && data.except != this.#internalId) {
          this.#emitter.emit(type, data);
        }
      }
    });

    this.#sessionUpdateIv = setInterval(() => this.updateSession(), 60 * 1000);
  }

  private async updateSession() {
    let redis = await redisPromise;

    if (this.#sessionStartedAt) {
      await redis.set(
        keys.session(this.info.sessionId),
        JSON.stringify({ start: this.#sessionStartedAt }),
        { EX: 60 * 10 }
      );
    }
  }

  private async sendInternal<T extends keyof MICBusEvents>(type: T, payload: MICBusEvents[T]) {
    let redis = await redisPromise;
    await redis.publish(keys.session(this.info.sessionId), JSON.stringify([type, payload]));
  }

  #isClosed = false;
  async close(opts?: { isDuplicateClose?: boolean }) {
    if (this.#isClosed) return;
    this.#isClosed = true;

    if (this.#sessionUpdateIv) {
      clearInterval(this.#sessionUpdateIv);
      this.#sessionUpdateIv = null;
    }

    if (this.#subRedis) {
      await this.#subRedis.quit();
      this.#subRedis = null;
    }

    this.#emitter.clear();

    let redis = await redisPromise;

    // We it's a duplicate close, we don't want to remove the
    // connectionId from the session members since it will be
    // removed by the new owner.
    if (!opts?.isDuplicateClose) {
      await redis.sRem(keys.sessionMembers(this.info.sessionId), this.info.connectionId);
    }

    this.#emitter.emit('close', undefined);
  }

  async sendMessage(payload: any, opts?: { isSelf?: boolean }) {
    await this.#initPromise;
    await this.sendInternal('message', {
      connectionId: this.info.connectionId,
      payload,
      isSelf: opts?.isSelf
    });
  }

  async onMessage(callback: (data: any) => void, opts?: { once?: boolean }) {
    await this.#initPromise;

    let unsub = this.#emitter.on('message', data => {
      callback(data.payload);
      if (opts?.once) unsub();
    });
  }

  async onClose(callback: () => void, opts?: { once?: boolean }) {
    await this.#initPromise;

    let unsub = this.#emitter.on('close', () => {
      callback();
      if (opts?.once) unsub();
    });
  }
}
