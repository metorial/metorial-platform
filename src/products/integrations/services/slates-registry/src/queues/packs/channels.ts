import { createCron } from '@lowerdeck/cron';
import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { slatePackBuildService } from '../../services/slatePackBuild';
import { canBuildPacks, slatePackChannelService } from '../../services/slatePackChannel';

let maxIncrementalStepsPerRun = 20;

let continueDelayMs = 30 * 1000;

let staleBuildMs = 6 * 60 * 60 * 1000;

export let slatePackChannelCron = createCron(
  {
    name: 'sreg/packs/channel/cron',
    cron: '37 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (!canBuildPacks()) return;

    await slatePackBuildService.failStale({ olderThanMs: staleBuildMs });

    let channels = await slatePackChannelService.ensureChannels();

    await buildSlatePackChannelQueue.addManyWithOps(
      channels.map(channel => ({
        data: { channelId: channel.id },
        opts: { deduplication: { id: `slate-pack-channel-${channel.id}` } }
      }))
    );
  }
);

export let buildSlatePackChannelQueue = createQueue<{
  channelId: string;
  forceFullSync?: boolean;
  reset?: boolean;
  rewindFeed?: boolean;
  manual?: boolean;
}>({
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

    let run = await slatePackBuildService.start({
      channelId: data.channelId,
      trigger: data.manual ? 'manual' : 'scheduled',
      forceFullSync: !!data.forceFullSync,
      reset: !!data.reset,
      rewindFeed: !!data.rewindFeed
    });

    try {
      if (data.reset) await slatePackChannelService.resetReleases({ ...data, run });
      if (data.rewindFeed) await slatePackChannelService.rewindFeed({ ...data, run });

      let steps = 0;
      while (
        steps < maxIncrementalStepsPerRun &&
        (await slatePackChannelService.buildIncremental({ channelId: data.channelId, run }))
      ) {
        steps++;
      }

      await slatePackChannelService.buildFullSyncIfDue({
        channelId: data.channelId,
        force: data.forceFullSync || data.reset,
        run
      });
      await slatePackChannelService.prune({ channelId: data.channelId, run });

      if (steps === maxIncrementalStepsPerRun) {
        await run.log(
          `Built ${steps} packs in this run, continuing in ${continueDelayMs / 1000} seconds.`
        );
        await buildSlatePackChannelQueue.add(
          { channelId: data.channelId, manual: data.manual },
          { delay: continueDelayMs }
        );
      }

      await run.log('Finished.');
      await run.finish();
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error);
      await run.log(`Failed: ${message}`);
      await run.finish({ error: message });

      await slatePackChannelService.recordBuildError({ channelId: data.channelId, error });
      throw error;
    }
  })
);
