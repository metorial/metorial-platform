import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { getId } from '../id';

let maxLogLines = 2000;

let maxLogLineLength = 1000;

type BuildRunOptions = {
  channelId: string;
  trigger: 'scheduled' | 'manual';
  forceFullSync: boolean;
  reset: boolean;
  rewindFeed: boolean;
};

export type BuildRun = {
  trigger: 'scheduled' | 'manual';
  log: (message: string) => Promise<void>;
  releaseWritten: () => Promise<void>;
  finish: (d?: { error?: string }) => Promise<void>;
};

class slatePackBuildServiceImpl {
  // Scheduled runs happen every hour and mostly find nothing to do, so they only get a
  // database entry once they log something. Manual runs always get one.
  async start(d: BuildRunOptions): Promise<BuildRun> {
    let channel = await db.slatePackChannel.findUnique({ where: { id: d.channelId } });
    if (!channel) throw new ServiceError(notFoundError('slate_pack_channel'));

    let buildOid: bigint | null = null;
    let lineCount = 0;
    let queue: Promise<unknown> = Promise.resolve();
    let enqueue = <T>(task: () => Promise<T>) => {
      let next = queue.then(task, task);
      queue = next.catch(() => {});
      return next;
    };

    let ensureBuild = async (firstLine?: string) => {
      if (buildOid) return buildOid;

      let build = await db.slatePackBuild.create({
        data: {
          ...getId('slatePackBuild'),
          channelOid: channel.oid,
          trigger: d.trigger,
          forceFullSync: d.forceFullSync,
          reset: d.reset,
          rewindFeed: d.rewindFeed,
          logs: firstLine ? [firstLine] : []
        }
      });
      buildOid = build.oid;
      return buildOid;
    };

    if (d.trigger === 'manual') await ensureBuild();

    return {
      trigger: d.trigger,
      log: message =>
        enqueue(async () => {
          if (lineCount > maxLogLines) return;

          let line =
            lineCount === maxLogLines
              ? `${new Date().toISOString()} Log limit reached, further lines are dropped.`
              : `${new Date().toISOString()} ${message.slice(0, maxLogLineLength)}`;
          lineCount++;

          if (!buildOid) {
            await ensureBuild(line);
            return;
          }

          await db.slatePackBuild.update({
            where: { oid: buildOid },
            data: { logs: { push: line } }
          });
        }).catch(() => {}),

      releaseWritten: () =>
        enqueue(async () => {
          if (!buildOid) return;

          await db.slatePackBuild.update({
            where: { oid: buildOid },
            data: { releasesWritten: { increment: 1 } }
          });
        }).catch(() => {}),

      finish: d =>
        enqueue(async () => {
          if (!buildOid) return;

          await db.slatePackBuild.update({
            where: { oid: buildOid },
            data: {
              status: d?.error ? 'failed' : 'completed',
              error: d?.error?.slice(0, 1000),
              completedAt: new Date()
            }
          });
        }).catch(() => {})
    };
  }

  async listForChannel(d: { channelOid: bigint }) {
    return Paginator.create(
      ({ prisma }) =>
        prisma(async opts =>
          db.slatePackBuild.findMany({
            ...opts,
            where: { channelOid: d.channelOid },
            select: {
              oid: true,
              id: true,
              status: true,
              trigger: true,
              forceFullSync: true,
              reset: true,
              rewindFeed: true,
              releasesWritten: true,
              error: true,
              startedAt: true,
              completedAt: true
            }
          })
        ),
      { defaultOrder: 'desc' }
    );
  }

  async getForChannel(d: { channelOid: bigint; id: string }) {
    let build = await db.slatePackBuild.findFirst({
      where: { id: d.id, channelOid: d.channelOid }
    });
    if (!build) throw new ServiceError(notFoundError('slate_pack_build'));

    return build;
  }

  // A worker that dies mid-build never finishes its entry.
  async failStale(d: { olderThanMs: number }) {
    return db.slatePackBuild.updateMany({
      where: {
        status: 'running',
        startedAt: { lt: new Date(Date.now() - d.olderThanMs) }
      },
      data: {
        status: 'failed',
        error: 'The build stopped without finishing.',
        completedAt: new Date()
      }
    });
  }
}

export let slatePackBuildService = Service.create(
  'slatePackBuildService',
  () => new slatePackBuildServiceImpl()
).build();
