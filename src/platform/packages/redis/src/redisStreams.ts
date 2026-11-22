import { randomNumber } from '@lowerdeck/random-number';
import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import { getConfig } from '@metorial/config';
import { generateCustomId } from '@metorial/id';
import Redis from 'ioredis';
import PQueue from 'p-queue';
import { parseRedisUrl } from './utils/parseRedisUrl';

let Sentry = getSentry();

let MIN_IDLE_TIME_FOR_AUTOCLAIM = 1000 * 60 * 5;
let STREAM_TRIM_DELAY_MS = 1000 * 60 * 15;

export class RedisStreams<Message> {
  constructor(
    private readonly name: string,
    private readonly redisUrl?: string
  ) {
    let config = getConfig();
    this.redisUrl = redisUrl ?? config.redisUrl;
  }

  private createRedis() {
    return new Redis(parseRedisUrl(this.redisUrl!));
  }

  async createReceiver(
    opts: { groupId: string; consumerId?: string; concurrency?: number },
    processor: (msg: Message) => Promise<any>
  ) {
    let redis = this.createRedis();

    let queue = new PQueue({ concurrency: opts.concurrency ?? 10 });

    // Create the consumer group
    try {
      await redis.xgroup('CREATE', this.name, opts.groupId, '$', 'MKSTREAM');
    } catch (e: any) {
      // Ignore BUSYGROUP errors -> group already exists
      if (!e.message.includes('BUSYGROUP')) {
        redis.disconnect();
        Sentry.captureException(e);
        throw e;
      }
    }

    let consumerId = opts.consumerId ?? generateCustomId('evcns');

    let iteration = 0;
    let randomClaimIteration = randomNumber(50, 100);
    let reader = this.createRedis();

    try {
      while (true) {
        let response = await reader.xreadgroup(
          'GROUP',
          opts.groupId,
          consumerId,
          'COUNT',
          20, // Maximum number of entries to read
          'BLOCK',
          100, // Block for 100ms to wait for new entries (avoid polling)
          'STREAMS',
          this.name,
          '>' // Next entry ID that no consumer in this group has read
        );

        let messages: any[] = [];

        if (response && response.length > 0) {
          messages = response.flatMap(([streamName, entries]: any) =>
            entries.map(([id, fields]: any) => ({
              id,
              message: {
                payload: fields[1] // ioredis returns fields as ['key', 'value', ...]
              }
            }))
          );
        }

        if (iteration++ % randomClaimIteration == 0) {
          let claimRes: any = await redis.xautoclaim(
            this.name,
            opts.groupId,
            consumerId,
            MIN_IDLE_TIME_FOR_AUTOCLAIM,
            '0-0',
            'COUNT',
            100
          );

          // claimRes format: [next_id, claimed_messages, deleted_message_ids]
          if (claimRes && claimRes[1]) {
            let claimedMessages = claimRes[1].map(([id, fields]: any) => ({
              id,
              message: {
                payload: fields[1]
              }
            }));
            messages.push(...claimedMessages);
          }
        }

        for (let msg of messages) {
          queue.add(async () => {
            await processor(serialize.decode(msg.message.payload));
            await redis.xack(this.name, opts.groupId, msg.id);
          });
        }
      }
    } finally {
      reader.disconnect();
      await queue.onIdle();
      redis.disconnect();
    }
  }

  private trimScheduled = false;

  private scheduleTrim(redis: Redis) {
    if (this.trimScheduled) return;
    this.trimScheduled = true;

    setTimeout(async () => {
      try {
        await redis.xtrim(this.name, 'MAXLEN', '~', 10_000);
      } catch (error) {
        Sentry.captureException(error);
        console.error(`Failed to trim Redis stream ${this.name}`, error);
      } finally {
        this.trimScheduled = false;
      }
    }, STREAM_TRIM_DELAY_MS).unref();
  }

  private sendRedisConnection?: Redis;

  async send(payload: Message) {
    let redis = (this.sendRedisConnection ??= this.createRedis());
    await redis.xadd(this.name, '*', 'payload', serialize.encode(payload));
    this.scheduleTrim(redis);
  }
}
