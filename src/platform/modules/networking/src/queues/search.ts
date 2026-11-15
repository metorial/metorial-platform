import { db } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { deleteFirewallDocument, indexFirewallDocument } from '@metorial/module-search';
import { createQueue } from '@metorial/queue';

export let indexFirewallQueue = createQueue<{ firewallId: string }>({
  name: 'net/search/firewall',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let indexFirewallQueueProcessor = indexFirewallQueue.process(async data => {
  let firewall = await db.firewall.findUnique({
    where: { id: data.firewallId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      instance: { select: { id: true } }
    }
  });

  if (!firewall || firewall.status === 'deleted') {
    await deleteFirewallDocument({ id: data.firewallId });
    return;
  }

  await indexFirewallDocument({
    id: firewall.id,
    instanceId: firewall.instance.id,
    name: firewall.name,
    description: firewall.description
  });
});

Fabric.listen('networking.firewall.mirrored:after', async ({ firewallId }) => {
  await indexFirewallQueue.add({ firewallId });
});
