import { Service } from '@lowerdeck/service';
import {
  getRegional,
  type SandboxMachineEventFilter,
  type SandboxMachineWithTenant
} from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';

class SandboxMachineEventServiceImpl {
  list(d: {
    machine: SandboxMachineWithTenant;
    instanceIds?: string[];
    scope?: 'all' | 'machine' | 'instance';
    types?: SandboxMachineEventFilter['types'];
    sources?: SandboxMachineEventFilter['sources'];
    reverse?: boolean;
  }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return createRemotePaginator(page =>
      genesis.machine.event.list({
        tenantId,
        machineId: d.machine.id,
        instanceIds: d.instanceIds,
        scope: d.scope,
        types: d.types,
        sources: d.sources,
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
