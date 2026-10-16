import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { sandboxEgressPolicyInternalService } from '../internal/egressPolicyInternal';
import { sandboxMachineEgressInternalService } from '../internal/machineEgressInternal';
import { ignoreNotFound } from '../lib/ignoreNotFound';
import { getRegional } from '../lib/regional';

let pageSize = 200;
let unusedGraceMs = 24 * 60 * 60 * 1000;

export let egressNetworkPolicyChangedManyQueue = createQueue<{
  networkPolicyId: string;
  cursor?: string;
}>({
  name: 'sbx/egress/networkPolicy/changed/many',
  workerOpts: { concurrency: 2, limiter: { max: 5, duration: 1000 } }
});

export let egressNetworkPolicyChangedManyProcessor =
  egressNetworkPolicyChangedManyQueue.process(async data => {
    let links = await db.firewallNetworkPolicy.findMany({
      where: {
        networkPolicy: { id: data.networkPolicyId },
        ...(data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {})
      },
      orderBy: { oid: 'asc' },
      take: pageSize,
      include: { firewall: { select: { id: true } } }
    });
    if (!links.length) return;

    await egressFirewallChangedManyQueue.addMany(
      links.map(link => ({ firewallId: link.firewall.id }))
    );

    if (links.length == pageSize) {
      await egressNetworkPolicyChangedManyQueue.add({
        networkPolicyId: data.networkPolicyId,
        cursor: links[links.length - 1]!.oid.toString()
      });
    }
  });

export let egressFirewallChangedManyQueue = createQueue<{
  firewallId: string;
  cursor?: string;
}>({
  name: 'sbx/egress/firewall/changed/many',
  workerOpts: { concurrency: 2, limiter: { max: 5, duration: 1000 } }
});

export let egressFirewallChangedManyProcessor = egressFirewallChangedManyQueue.process(
  async data => {
    let links = await db.sandboxEgressPolicyFirewall.findMany({
      where: {
        firewall: { id: data.firewallId },
        ...(data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {})
      },
      orderBy: { oid: 'asc' },
      take: pageSize,
      include: { policy: { select: { id: true } } }
    });
    if (!links.length) return;

    await egressRecompileSingleQueue.addMany(
      links.map(link => ({ egressPolicyId: link.policy.id }))
    );

    if (links.length == pageSize) {
      await egressFirewallChangedManyQueue.add({
        firewallId: data.firewallId,
        cursor: links[links.length - 1]!.oid.toString()
      });
    }
  }
);

export let egressRecompileSingleQueue = createQueue<{ egressPolicyId: string }>({
  name: 'sbx/egress/recompile/single',
  workerOpts: { concurrency: 10, limiter: { max: 50, duration: 1000 } }
});

export let egressRecompileSingleProcessor = egressRecompileSingleQueue.process(async data => {
  let policy = await db.sandboxEgressPolicy.findUnique({ where: { id: data.egressPolicyId } });
  if (!policy) return;

  let result = await sandboxEgressPolicyInternalService.compile({ policyOid: policy.oid });
  if (result.status == 'invalid' || !result.changed) return;

  await egressRegionManyQueue.add({ egressPolicyId: policy.id });
});

export let egressRegionManyQueue = createQueue<{ egressPolicyId: string; cursor?: string }>({
  name: 'sbx/egress/region/many',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let egressRegionManyProcessor = egressRegionManyQueue.process(async data => {
  let policy = await db.sandboxEgressPolicy.findUnique({ where: { id: data.egressPolicyId } });
  if (!policy) return;

  let regions = await db.sandboxEgressPolicyRegion.findMany({
    where: {
      policyOid: policy.oid,
      status: { not: 'deleting' },
      ...(data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {})
    },
    orderBy: { oid: 'asc' },
    take: pageSize
  });
  if (!regions.length) return;

  let stale = regions.filter(
    region => region.status != 'synced' || region.syncedRevision < policy.revision
  );
  await egressRegionSingleQueue.addMany(stale.map(region => ({ regionId: region.id })));

  if (regions.length == pageSize) {
    await egressRegionManyQueue.add({
      egressPolicyId: data.egressPolicyId,
      cursor: regions[regions.length - 1]!.oid.toString()
    });
  }
});

export let egressRegionSingleQueue = createQueue<{ regionId: string }>({
  name: 'sbx/egress/region/single',
  workerOpts: { concurrency: 10, limiter: { max: 50, duration: 1000 } }
});

export let egressRegionSingleProcessor = egressRegionSingleQueue.process(async data => {
  let region = await db.sandboxEgressPolicyRegion.findUnique({ where: { id: data.regionId } });
  if (!region || region.status == 'deleting') return;

  await sandboxEgressPolicyInternalService.syncRegion({ regionOid: region.oid });
});

export let egressMachineSingleQueue = createQueue<{ machineId: string }>({
  name: 'sbx/egress/machine/single',
  workerOpts: { concurrency: 10, limiter: { max: 50, duration: 1000 } }
});

export let egressMachineSingleProcessor = egressMachineSingleQueue.process(async data => {
  let machine = await db.sandboxMachine.findUnique({ where: { id: data.machineId } });
  if (!machine) return;

  await sandboxMachineEgressInternalService.sync({ machineOid: machine.oid });
});

export let egressMachineManyQueue = createQueue<{ cursor?: string }>({
  name: 'sbx/egress/machine/many',
  workerOpts: { concurrency: 1, limiter: { max: 5, duration: 1000 } }
});

export let egressMachineManyProcessor = egressMachineManyQueue.process(async data => {
  let machines = await db.sandboxMachine.findMany({
    where: {
      needsEgressSync: true,
      status: 'active',
      ...(data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {})
    },
    orderBy: { oid: 'asc' },
    take: pageSize,
    select: { oid: true, id: true }
  });
  if (!machines.length) return;

  await egressMachineSingleQueue.addMany(machines.map(machine => ({ machineId: machine.id })));

  if (machines.length == pageSize) {
    await egressMachineManyQueue.add({
      cursor: machines[machines.length - 1]!.oid.toString()
    });
  }
});

export let egressMachineCron = createCron(
  { name: 'sbx/egress/machine/cron', cron: '* * * * *' },
  async () => {
    await egressMachineManyQueue.add({});
  }
);

export let egressRecompileManyQueue = createQueue<{ cursor?: string }>({
  name: 'sbx/egress/recompile/many',
  workerOpts: { concurrency: 1, limiter: { max: 2, duration: 1000 } }
});

export let egressRecompileManyProcessor = egressRecompileManyQueue.process(async data => {
  let policies = await db.sandboxEgressPolicy.findMany({
    where: {
      OR: [{ needsCompile: true }, { status: 'active' }],
      ...(data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {})
    },
    orderBy: { oid: 'asc' },
    take: pageSize,
    select: { oid: true, id: true }
  });
  if (!policies.length) return;

  await egressRecompileSingleQueue.addMany(
    policies.map(policy => ({ egressPolicyId: policy.id }))
  );

  if (policies.length == pageSize) {
    await egressRecompileManyQueue.add({
      cursor: policies[policies.length - 1]!.oid.toString()
    });
  }
});

export let egressRecompileCron = createCron(
  { name: 'sbx/egress/recompile/cron', cron: '*/15 * * * *' },
  async () => {
    await egressRecompileManyQueue.add({});
  }
);

export let egressGcManyQueue = createQueue<{ cursor?: string }>({
  name: 'sbx/egress/gc/many',
  workerOpts: { concurrency: 1, limiter: { max: 2, duration: 1000 } }
});

export let egressGcManyProcessor = egressGcManyQueue.process(async data => {
  let policies = await db.sandboxEgressPolicy.findMany({
    where: {
      machines: { none: { status: 'active' } },
      ...(data.cursor ? { oid: { gt: BigInt(data.cursor) } } : {})
    },
    orderBy: { oid: 'asc' },
    take: pageSize,
    select: { oid: true, id: true }
  });
  if (!policies.length) return;

  await egressGcSingleQueue.addMany(policies.map(policy => ({ egressPolicyId: policy.id })));

  if (policies.length == pageSize) {
    await egressGcManyQueue.add({ cursor: policies[policies.length - 1]!.oid.toString() });
  }
});

export let egressGcSingleQueue = createQueue<{ egressPolicyId: string }>({
  name: 'sbx/egress/gc/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let egressGcSingleProcessor = egressGcSingleQueue.process(async data => {
  let policy = await db.sandboxEgressPolicy.findUnique({
    where: { id: data.egressPolicyId },
    include: { regions: { include: { tenant: { include: { region: true } } } } }
  });
  if (!policy) return;

  let inUse = await db.sandboxMachine.count({
    where: { egressPolicyOid: policy.oid, status: 'active' }
  });
  if (inUse > 0) return;

  if (!policy.unusedAt) {
    await db.sandboxEgressPolicy.update({
      where: { oid: policy.oid },
      data: { unusedAt: new Date() }
    });

    return;
  }
  if (Date.now() - policy.unusedAt.getTime() < unusedGraceMs) return;

  for (let region of policy.regions) {
    await db.sandboxEgressPolicyRegion.update({
      where: { oid: region.oid },
      data: { status: 'deleting' }
    });

    if (region.genesisId) {
      let { genesis, tenantId } = getRegional(region.tenant);
      await ignoreNotFound(
        genesis.egressPolicy.delete({ tenantId, policyId: region.genesisId })
      );
    }
  }

  await db.sandboxMachine.updateMany({
    where: { appliedEgressRegionOid: { in: policy.regions.map(region => region.oid) } },
    data: { appliedEgressRegionOid: null }
  });
  await db.sandboxEgressPolicy.delete({ where: { oid: policy.oid } });
});

export let egressGcCron = createCron(
  { name: 'sbx/egress/gc/cron', cron: '17 * * * *' },
  async () => {
    await egressGcManyQueue.add({});
  }
);

export let egressProcessors = combineQueueProcessors([
  egressNetworkPolicyChangedManyProcessor,
  egressFirewallChangedManyProcessor,
  egressRecompileSingleProcessor,
  egressRegionManyProcessor,
  egressRegionSingleProcessor,
  egressMachineSingleProcessor,
  egressMachineManyProcessor,
  egressMachineCron,
  egressRecompileManyProcessor,
  egressRecompileCron,
  egressGcManyProcessor,
  egressGcSingleProcessor,
  egressGcCron
]);
