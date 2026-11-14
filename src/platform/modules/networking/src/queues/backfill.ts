import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { db as subspaceDb } from '@metorial-subspace/db';
import { importFirewall, importNetworkPolicy } from '../internal/subspaceImport';

let pageSize = 200;

type ImportKind = 'firewall' | 'network_policy';

export let backfillSingleQueue = createQueue<{ kind: ImportKind; id: string }>({
  name: 'net/backfill/single',
  workerOpts: { concurrency: 5, limiter: { max: 50, duration: 1000 } }
});

export let backfillSingleProcessor = backfillSingleQueue.process(async data => {
  if (data.kind == 'firewall') await importFirewall({ firewallId: data.id });
  else await importNetworkPolicy({ networkPolicyId: data.id });
});

export let backfillManyQueue = createQueue<{ kind: ImportKind; cursor?: string }>({
  name: 'net/backfill/many',
  workerOpts: { concurrency: 1, limiter: { max: 2, duration: 1000 } }
});

export let backfillManyProcessor = backfillManyQueue.process(async data => {
  let where = data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {};

  let rows =
    data.kind == 'firewall'
      ? await subspaceDb.firewall.findMany({
          where,
          orderBy: { oid: 'asc' },
          take: pageSize,
          select: { oid: true, id: true }
        })
      : await subspaceDb.networkPolicy.findMany({
          where,
          orderBy: { oid: 'asc' },
          take: pageSize,
          select: { oid: true, id: true }
        });
  if (!rows.length) return;

  let known = new Set(
    (data.kind == 'firewall'
      ? await db.firewall.findMany({
          where: { id: { in: rows.map(row => row.id) } },
          select: { id: true }
        })
      : await db.networkPolicy.findMany({
          where: { id: { in: rows.map(row => row.id) } },
          select: { id: true }
        })
    ).map(row => row.id)
  );

  await backfillSingleQueue.addMany(
    rows.filter(row => !known.has(row.id)).map(row => ({ kind: data.kind, id: row.id }))
  );

  if (rows.length == pageSize) {
    await backfillManyQueue.add({
      kind: data.kind,
      cursor: rows[rows.length - 1]!.oid.toString()
    });
  }
});

export let startNetworkingBackfill = async () => {
  await backfillManyQueue.add({ kind: 'network_policy' }, { id: 'startup-network_policy' });
  await backfillManyQueue.add({ kind: 'firewall' }, { id: 'startup-firewall' });
};

export let backfillProcessors = combineQueueProcessors([
  backfillSingleProcessor,
  backfillManyProcessor
]);
