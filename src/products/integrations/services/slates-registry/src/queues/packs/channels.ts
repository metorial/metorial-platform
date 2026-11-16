import { createCron } from '@lowerdeck/cron';
import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { canBuildPacks, slatePackChannelService } from '../../services/slatePackChannel';

let maxIncrementalStepsPerRun = 20;

let continueDelayMs = 30 * 1000;

export let slatePackChannelCron = createCron(
  {
    name: 'sreg/packs/channel/cron',
    cron: '37 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (!canBuildPacks()) return;

    let channels = await slatePackChannelService.ensureChannels();

    await buildSlatePackChannelQueue.addManyWithOps(
      channels.map(channel => ({
        data: { channelId: channel.id },
        opts: { deduplication: { id: `slate-pack-channel-${channel.id}` } }
      }))
    );
  }
);

export let buildSlatePackChannelQueue = createQueue<{ channelId: string; forceFullSync?: boolean; reset?: boolean; rewindFeed?: boolean }>({
  name: 'sreg/packs/channel/build',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

let channelLock = createLock({
  name: 'sreg/packs/channel/lock',
  redisUrl: env.service.REDIS_URL
});

export let buildSlatePackChannelProcessor = buildSlatePackChannelQueue.process(async data =>
  channelLock.usingLock(data.channelId, async () => {
    if (!canBuildPacks()) return;

    try {
      if (data.reset) await slatePackChannelService.resetReleases({ channelId: data.channelId });

      if (data.rewindFeed) await slatePackChannelService.rewindFeed({ channelId: data.channelId });

      let steps = 0;
      while (
        steps < maxIncrementalStepsPerRun &&
        (await slatePackChannelService.buildIncremental(data))
      ) {
        steps++;
      }

      await slatePackChannelService.buildFullSyncIfDue({
        channelId: data.channelId,
        force: data.forceFullSync || data.reset
      });
      await slatePackChannelService.prune(data);

      if (steps === maxIncrementalStepsPerRun) {
        await buildSlatePackChannelQueue.add(
          { channelId: data.channelId },
          { delay: continueDelayMs }
        );
      }
    } catch (error) {
      await slatePackChannelService.recordBuildError({ channelId: data.channelId, error });
      throw error;
    }
  })
);
