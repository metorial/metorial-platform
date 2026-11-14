import { createLock } from '@lowerdeck/lock';
import { db } from '../db';
import { env } from '../env';

let repositorySyncWriteLock = createLock({
  name: 'origin/scm/repository-sync/write',
  redisUrl: env.service.REDIS_URL
});

// Closing superseded PRs, merging, and exporting files must not race for the same repo.
export let withRepositorySyncWriteLock =
  <T extends { syncId: string }>(run: (data: T) => Promise<void>) =>
  async (data: T) => {
    let sync = await db.scmRepositorySync.findUnique({
      where: { id: data.syncId },
      select: { repoOid: true }
    });
    if (!sync) return;

    await repositorySyncWriteLock.usingLock(sync.repoOid.toString(), () => run(data));
  };
