import { db, withTransaction } from '@metorial/db';

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
