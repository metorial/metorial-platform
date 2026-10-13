import { Service } from '@lowerdeck/service';
import { getRegional, type SandboxMachineWithTenant } from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';

class SandboxMachineEventServiceImpl {
  list(d: {
    machine: SandboxMachineWithTenant;
    instanceId?: string;
    scope?: 'all' | 'machine' | 'instance';
    reverse?: boolean;
  }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return createRemotePaginator(page =>
      genesis.machine.event.list({
        tenantId,
        machineId: d.machine.id,
        instanceId: d.instanceId,
        scope: d.scope,
        reverse: d.reverse,
        ...page
      })
    );
  }

  async get(d: { machine: SandboxMachineWithTenant; eventId: string }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return await genesis.machine.event.get({
      tenantId,
      machineId: d.machine.id,
      eventId: d.eventId
    });
  }
}

export let sandboxMachineEventService = Service.create(
  'sandboxMachineEventService',
  () => new SandboxMachineEventServiceImpl()
).build();
