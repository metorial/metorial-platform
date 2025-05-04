import { getConfig } from '@metorial/config';
import { generateCustomId } from '@metorial/id';
import { randomNumber } from '@metorial/random-number';
import { getSentry } from '@metorial/sentry';
import { serialize } from '@metorial/serialize';
import PQueue from 'p-queue';
import { commandOptions, RedisClientType } from 'redis';
import { createRedisClient } from './redis';

let Sentry = getSentry();

let MIN_IDLE_TIME_FOR_AUTOCLAIM = 1000 * 60 * 5;

export class RedisStreams<Message> {
  constructor(
    private readonly name: string,
    private readonly redisUrl?: string
  ) {
    let config = getConfig();
    redisUrl = redisUrl ?? config.redisUrl;
  }

  private async createRedis() {
    return createRedisClient({ url: this.redisUrl }).eager();
  }

  async createReceiver(
    opts: { groupId: string; consumerId?: string; concurrency?: number },
    processor: (msg: Message) => Promise<any>
  ) {
    let redis = await this.createRedis();

    let queue = new PQueue({ concurrency: opts.concurrency ?? 10 });

    // Create the consumer group
    try {
      await redis.xGroupCreate(this.name, opts.groupId, '$', {
        MKSTREAM: true
      });
    } catch (e: any) {
      // Ignore BUSYGROUP errors -> group already exists
      if (!e.message.includes('BUSYGROUP')) {
        Sentry.captureException(e);
        throw e;
      }
    }

    let consumerId = opts.consumerId ?? generateCustomId('evcns');

    let iteration = 0;
    let randomClaimIteration = randomNumber(50, 100);

    // Create the consumer
    while (true) {
      let response =
        (await redis.xReadGroup(
          commandOptions({
            // Create a new redis instance for each read group
            // To avoid blocking the main redis instance (e.g., for ACKs)
            isolated: true
          }),
          opts.groupId,
          consumerId,
          [
            {
              key: this.name,
              id: '>' // Next entry ID that no consumer in this group has read
            }
          ],
          {
            COUNT: 20, // Maximum number of entries to read
            BLOCK: 100 // Block for 1 second to wait for new entries (avoid polling)
          }
        )) ?? [];

      let messages = response.flatMap(entry => entry.messages);

      if (iteration++ % randomClaimIteration == 0) {
        let claimRes = await redis.xAutoClaim(
          this.name,
          opts.groupId,
          consumerId,
          MIN_IDLE_TIME_FOR_AUTOCLAIM,
          '0-0',
          {
            COUNT: 100
          }
        );

        messages.push(...(claimRes.messages.filter(m => m) as any));
      }

      for (let msg of messages) {
        queue.add(async () => {
          await processor(serialize.decode(msg.message.payload));
          await redis.xAck(this.name, opts.groupId, msg.id);
        });
      }
    }
  }

  private hasInstallCleanup = false;
  private installCleanup() {
    if (this.hasInstallCleanup) return;

    setTimeout(
      async () => {
        let redis = await this.createRedis();

        await redis.xTrim(this.name, 'MAXLEN', 10_000, {
          strategyModifier: '~'
        });

        await redis.quit();
      },
      1000 * 60 * 15
    );
  }

  private sendRedisConnection?: RedisClientType;
  async send(payload: Message) {
    if (!this.sendRedisConnection) {
      this.sendRedisConnection = (await this.createRedis()) as RedisClientType;
    }

    await this.sendRedisConnection.xAdd(this.name, '*', {
      payload: serialize.encode(payload)
    });

    this.installCleanup();
  }
}
