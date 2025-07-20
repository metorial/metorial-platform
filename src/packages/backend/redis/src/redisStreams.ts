import { getConfig } from '@metorial/config';
import { generateCustomId } from '@metorial/id';
import { randomNumber } from '@metorial/random-number';
import { getSentry } from '@metorial/sentry';
import { serialize } from '@metorial/serialize';
import Redis from 'ioredis';
import PQueue from 'p-queue';

let Sentry = getSentry();

let MIN_IDLE_TIME_FOR_AUTOCLAIM = 1000 * 60 * 5;

export class RedisStreams<Message> {
  constructor(
    private readonly name: string,
    private readonly redisUrl?: string
  ) {
    let config = getConfig();
    this.redisUrl = redisUrl ?? config.redisUrl;
  }

  private async createRedis() {
    return new Redis(this.redisUrl!);
  }

  async createReceiver(
    opts: { groupId: string; consumerId?: string; concurrency?: number },
    processor: (msg: Message) => Promise<any>
  ) {
    let redis = await this.createRedis();

    let queue = new PQueue({ concurrency: opts.concurrency ?? 10 });

    // Create the consumer group
    try {
      await redis.xgroup('CREATE', this.name, opts.groupId, '$', 'MKSTREAM');
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
      // Create a new redis instance for each read group
      // To avoid blocking the main redis instance (e.g., for ACKs)
      let isolatedRedis = await this.createRedis();

      let response = await isolatedRedis.xreadgroup(
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

      // Close the isolated connection after reading
      isolatedRedis.disconnect();

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
  }

  private hasInstallCleanup = false;
  private installCleanup() {
    if (this.hasInstallCleanup) return;

    setTimeout(
      async () => {
        let redis = await this.createRedis();

        await redis.xtrim(this.name, 'MAXLEN', '~', 10_000);

        await redis.quit();
      },
      1000 * 60 * 15
    );
  }

  private sendRedisConnection?: Redis;
  async send(payload: Message) {
    if (!this.sendRedisConnection) {
      this.sendRedisConnection = await this.createRedis();
    }

    await this.sendRedisConnection.xadd(this.name, '*', 'payload', serialize.encode(payload));

    this.installCleanup();
  }
}
