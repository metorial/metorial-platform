import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { db as subspaceDb } from '@metorial-subspace/db';
import { mirrorFirewall, mirrorNetworkPolicy } from '../internal/subspaceMirror';

let pageSize = 200;

type MirrorKind = 'firewall' | 'network_policy';

export let mirrorFirewallSingleQueue = createQueue<{ firewallId: string }>({
  name: 'net/mirror/firewall/single',
  workerOpts: { concurrency: 5, limiter: { max: 50, duration: 1000 } }
});

export let mirrorFirewallSingleProcessor = mirrorFirewallSingleQueue.process(async data => {
  await mirrorFirewall({ firewallId: data.firewallId });
});

export let mirrorNetworkPolicySingleQueue = createQueue<{ networkPolicyId: string }>({
  name: 'net/mirror/policy/single',
  workerOpts: { concurrency: 5, limiter: { max: 50, duration: 1000 } }
});

export let mirrorNetworkPolicySingleProcessor = mirrorNetworkPolicySingleQueue.process(
  async data => {
    await mirrorNetworkPolicy({ networkPolicyId: data.networkPolicyId });
  }
);

export let mirrorManyQueue = createQueue<{ kind: MirrorKind; cursor?: string }>({
  name: 'net/mirror/many',
  workerOpts: { concurrency: 1, limiter: { max: 5, duration: 1000 } }
});

export let mirrorManyProcessor = mirrorManyQueue.process(async data => {
  let cursor = data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {};
  let where = { needsSubspaceSync: true, ...cursor };

  if (data.kind == 'firewall') {
    let rows = await db.firewall.findMany({
      where,
      orderBy: { oid: 'asc' },
      take: pageSize,
      select: { oid: true, id: true }
    });
    if (!rows.length) return;

    await mirrorFirewallSingleQueue.addMany(rows.map(row => ({ firewallId: row.id })));
    if (rows.length == pageSize) {
      await mirrorManyQueue.add({
        kind: data.kind,
        cursor: rows[rows.length - 1]!.oid.toString()
      });
    }

    return;
  }

  let rows = await db.networkPolicy.findMany({
    where,
    orderBy: { oid: 'asc' },
    take: pageSize,
    select: { oid: true, id: true }
  });
  if (!rows.length) return;

  await mirrorNetworkPolicySingleQueue.addMany(rows.map(row => ({ networkPolicyId: row.id })));
  if (rows.length == pageSize) {
    await mirrorManyQueue.add({
      kind: data.kind,
      cursor: rows[rows.length - 1]!.oid.toString()
    });
  }
});

export let mirrorCron = createCron(
  { name: 'net/mirror/cron', cron: '* * * * *' },
  async () => {
    await mirrorManyQueue.addMany([{ kind: 'network_policy' }, { kind: 'firewall' }]);
  }
);

export let mirrorDriftManyQueue = createQueue<{ kind: MirrorKind; cursor?: string }>({
  name: 'net/mirror/drift/many',
  workerOpts: { concurrency: 1, limiter: { max: 2, duration: 1000 } }
});

export let mirrorDriftManyProcessor = mirrorDriftManyQueue.process(async data => {
  let cursor = data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {};

  let sources =
    data.kind == 'firewall'
      ? await db.firewall.findMany({
          where: cursor,
          orderBy: { oid: 'asc' },
          take: pageSize,
          select: { oid: true, id: true, revision: true }
        })
      : await db.networkPolicy.findMany({
          where: cursor,
          orderBy: { oid: 'asc' },
          take: pageSize,
          select: { oid: true, id: true, revision: true }
        });
  if (!sources.length) return;

  let ids = sources.map(source => source.id);
  let mirrored =
    data.kind == 'firewall'
      ? await subspaceDb.firewall.findMany({
          where: { id: { in: ids } },
          select: { id: true, sourceRevision: true }
        })
      : await subspaceDb.networkPolicy.findMany({
          where: { id: { in: ids } },
          select: { id: true, sourceRevision: true }
        });
  let revisions = new Map(mirrored.map(row => [row.id, row.sourceRevision]));

  let drifted = sources.filter(source => revisions.get(source.id) != source.revision);

  if (data.kind == 'firewall') {
    await mirrorFirewallSingleQueue.addMany(drifted.map(row => ({ firewallId: row.id })));
  } else {
    await mirrorNetworkPolicySingleQueue.addMany(
      drifted.map(row => ({ networkPolicyId: row.id }))
    );
  }

  if (sources.length == pageSize) {
    await mirrorDriftManyQueue.add({
      kind: data.kind,
      cursor: sources[sources.length - 1]!.oid.toString()
    });
  }
});

export let mirrorDriftCron = createCron(
  { name: 'net/mirror/drift/cron', cron: '*/30 * * * *' },
  async () => {
    await mirrorDriftManyQueue.addMany([{ kind: 'network_policy' }, { kind: 'firewall' }]);
  }
);

export let mirrorProcessors = combineQueueProcessors([
  mirrorFirewallSingleProcessor,
  mirrorNetworkPolicySingleProcessor,
  mirrorManyProcessor,
  mirrorCron,
  mirrorDriftManyProcessor,
  mirrorDriftCron
]);
