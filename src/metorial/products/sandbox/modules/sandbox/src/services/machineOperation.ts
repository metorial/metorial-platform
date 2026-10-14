import { Service } from '@lowerdeck/service';
import {
  getRegional,
  type SandboxMachineOperationFilter,
  type SandboxMachineWithTenant
} from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';

class SandboxMachineOperationServiceImpl {
  list(d: {
    machine: SandboxMachineWithTenant;
    instanceIds?: string[];
    kinds?: SandboxMachineOperationFilter['kinds'];
    triggers?: SandboxMachineOperationFilter['triggers'];
    outcomes?: SandboxMachineOperationFilter['outcomes'];
  }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return createRemotePaginator(page =>
      genesis.machine.operation.list({
        tenantId,
        machineId: d.machine.id,
        instanceIds: d.instanceIds,
        kinds: d.kinds,
        triggers: d.triggers,
        outcomes: d.outcomes,
        ...page
      })
    );
  }

  async get(d: { machine: SandboxMachineWithTenant; operationId: string }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return await genesis.machine.operation.get({
      tenantId,
      machineId: d.machine.id,
      operationId: d.operationId
    });
  }
}

export let sandboxMachineOperationService = Service.create(
  'sandboxMachineOperationService',
  () => new SandboxMachineOperationServiceImpl()
).build();
