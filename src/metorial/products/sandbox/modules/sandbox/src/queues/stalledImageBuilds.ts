import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { endImageBuild, terminalBuildStatuses } from '../lib/imageBuildEnd';
import { isSandboxingEnabled } from '../lib/regions';

let STALLED_AFTER_MS = 10 * 60 * 1000;
let PAGE_SIZE = 500;

let staleBefore = () => new Date(Date.now() - STALLED_AFTER_MS);

export let stalledImageBuildsCron = createCron(
  {
    name: 'sbx/image/build/stalled/cron',
    cron: '* * * * *'
  },
  async () => {
    if (!isSandboxingEnabled()) return;

    let cursor: bigint | undefined;

    while (true) {
      let builds = await db.sandboxMachineImageBuild.findMany({
        where: {
          status: { notIn: terminalBuildStatuses },
          lastCheckedAt: { lt: staleBefore() },
          ...(cursor ? { oid: { gt: cursor } } : {})
        },
        select: { oid: true },
        orderBy: { oid: 'asc' },
        take: PAGE_SIZE
      });

      await stalledImageBuildQueue.addManyWithOps(
        builds.map(build => ({
          data: { buildOid: build.oid.toString() },
          opts: { id: `stalled-${build.oid}` }
        }))
      );

      if (builds.length < PAGE_SIZE) break;
      cursor = builds[builds.length - 1]!.oid;
    }
  }
);

export let stalledImageBuildQueue = createQueue<{ buildOid: string }>({
  name: 'sbx/image/build/stalled/single',
  workerOpts: { concurrency: 5 }
});

export let stalledImageBuildQueueProcessor = stalledImageBuildQueue.process(async data => {
  let build = await db.sandboxMachineImageBuild.findFirst({
    where: {
      oid: BigInt(data.buildOid),
      status: { notIn: terminalBuildStatuses },
      lastCheckedAt: { lt: staleBefore() }
    },
    include: {
      regions: { include: { region: true, tenant: true }, orderBy: { oid: 'asc' } }
    }
  });
  if (!build) return;

  await endImageBuild({
    build,
    status: 'timed_out',
    failure: {
      code: 'build_stalled',
      message: 'The build stopped making progress and was terminated.'
    }
  });
});

export let stalledImageBuildProcessors = combineQueueProcessors([
  stalledImageBuildsCron,
  stalledImageBuildQueueProcessor
]);
