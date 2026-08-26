import { db, withTransaction } from '@metorial/db';

/**
 * Records that paths are no longer part of a destination.
 *
 * `SkillDestinationFile` tracks what the code bucket currently holds, so a
 * removed path has to disappear from it. Repositories, however, are updated
 * asynchronously and a propagation can fail or be linked after the fact, so the
 * removal is also written to `SkillDestinationDeletedFile`. Those tombstones are
 * what lets a repository catch up on deletions it missed; a retention cron
 * prunes them.
 */
export let recordDestinationFileDeletions = async (d: {
  destinationOid: bigint;
  paths: string[];
}) => {
  let paths = [...new Set(d.paths)].filter(path => path && path !== '/');
  if (paths.length === 0) return [];

  await withTransaction(async db => {
    await db.skillDestinationFile.deleteMany({
      where: {
        destinationOid: d.destinationOid,
        path: { in: paths }
      }
    });

    for (let path of paths) {
      await db.skillDestinationDeletedFile.upsert({
        where: {
          destinationOid_path: {
            destinationOid: d.destinationOid,
            path
          }
        },
        create: {
          destinationOid: d.destinationOid,
          path
        },
        update: { createdAt: new Date() }
      });
    }
  });

  return paths;
};

/**
 * Drops tombstones for paths that exist again, so a re-created file is not
 * deleted from a repository that had not yet caught up on its removal.
 */
export let forgetDestinationFileDeletions = async (d: {
  destinationOid: bigint;
  paths: string[];
}) => {
  let paths = [...new Set(d.paths)];
  if (paths.length === 0) return;

  await db.skillDestinationDeletedFile.deleteMany({
    where: {
      destinationOid: d.destinationOid,
      path: { in: paths }
    }
  });
};

/**
 * The window of tombstones a repository still has to apply.
 *
 * A null cursor means the repository has applied nothing yet and takes
 * everything up to the bound. `upTo` is what keeps the cursor honest: without
 * it, a deletion recorded while the repository update is in flight would be
 * marked applied without ever having been pushed.
 */
export let getPendingDestinationFileDeletionsWhere = (d: {
  destinationOid: bigint;
  appliedAt: Date | null;
  upTo: Date;
}) => ({
  destinationOid: d.destinationOid,
  createdAt: {
    ...(d.appliedAt ? { gt: d.appliedAt } : {}),
    lte: d.upTo
  }
});

export let getPendingDestinationFileDeletions = async (d: {
  destinationOid: bigint;
  appliedAt: Date | null;
  upTo: Date;
}) => {
  let deletions = await db.skillDestinationDeletedFile.findMany({
    where: getPendingDestinationFileDeletionsWhere(d),
    select: { path: true },
    orderBy: { createdAt: 'asc' }
  });

  return deletions.map(deletion => deletion.path);
};
