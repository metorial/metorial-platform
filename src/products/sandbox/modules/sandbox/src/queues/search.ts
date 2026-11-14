import { db } from '@metorial/db';
import {
  deleteSandboxDiskDocument,
  deleteSandboxImageDocument,
  deleteSandboxMachineDocument,
  indexSandboxDiskDocument,
  indexSandboxImageDocument,
  indexSandboxMachineDocument,
  sandboxGlobalSearchTenantId
} from '@metorial/module-search';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { getRegional, sandboxTenantInclude } from '../lib/regional';

export let indexSandboxImageQueue = createQueue<{ imageOid: string }>({
  name: 'sbx/search/image',
  workerOpts: { concurrency: 20 }
});

export let indexSandboxImageQueueProcessor = indexSandboxImageQueue.process(async data => {
  let image = await db.sandboxMachineImage.findUnique({
    where: { oid: BigInt(data.imageOid) },
    include: { instance: true }
  });
  if (!image) return;

  if (image.status == 'deleted') {
    await deleteSandboxImageDocument({ id: image.id });
    return;
  }

  await indexSandboxImageDocument({
    id: image.id,
    tenantId: image.instance?.id ?? sandboxGlobalSearchTenantId,
    name: image.name,
    identifier: image.identifier
  });
});

export let indexSandboxMachineQueue = createQueue<{ machineOid: string }>({
  name: 'sbx/search/machine',
  workerOpts: { concurrency: 20 }
});

export let indexSandboxMachineQueueProcessor = indexSandboxMachineQueue.process(async data => {
  let machine = await db.sandboxMachine.findUnique({
    where: { oid: BigInt(data.machineOid) },
    include: { instance: true, tenant: { include: sandboxTenantInclude } }
  });
  if (!machine) return;

  if (machine.status == 'deleted') {
    await deleteSandboxMachineDocument({ id: machine.id });
    return;
  }

  let { genesis, tenantId } = getRegional(machine.tenant);
  let remote = await genesis.machine.get({ tenantId, machineId: machine.id });

  await indexSandboxMachineDocument({
    id: machine.id,
    instanceId: machine.instance.id,
    name: remote.name,
    slug: remote.slug
  });
});

export let indexSandboxDiskQueue = createQueue<{ diskOid: string }>({
  name: 'sbx/search/disk',
  workerOpts: { concurrency: 20 }
});

export let indexSandboxDiskQueueProcessor = indexSandboxDiskQueue.process(async data => {
  let disk = await db.sandboxDisk.findUnique({
    where: { oid: BigInt(data.diskOid) },
    include: { instance: true }
  });
  if (!disk || disk.type == 'root_fs') return;

  if (disk.status == 'deleted') {
    await deleteSandboxDiskDocument({ id: disk.id });
    return;
  }

  await indexSandboxDiskDocument({
    id: disk.id,
    instanceId: disk.instance.id,
    name: disk.name
  });
});

export let searchProcessors = combineQueueProcessors([
  indexSandboxDiskQueueProcessor,
  indexSandboxImageQueueProcessor,
  indexSandboxMachineQueueProcessor
]);
