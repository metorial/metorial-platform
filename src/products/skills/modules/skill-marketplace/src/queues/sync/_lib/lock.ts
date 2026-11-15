import { createLock } from '@lowerdeck/lock';
import { getConfig } from '@metorial/config';
import { db } from '@metorial/db';

let destinationSyncLock = createLock({
  name: 'cargo/skill/sync/destination',
  redisUrl: getConfig().redisUrl
});

// Cancellation and bucket writes share a lock so an already-running older task finishes
// before its replacement starts reading or writing the destination manifest.
export let withDestinationSyncLock =
  <T extends { skillDestinationSyncId: string }>(run: (data: T) => Promise<void>) =>
  async (data: T) => {
    let sync = await db.skillDestinationSync.findUnique({
      where: { id: data.skillDestinationSyncId },
      select: { destinationOid: true }
    });
    if (!sync) return;

    await destinationSyncLock.usingLock(sync.destinationOid.toString(), () => run(data));
  };
