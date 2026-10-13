import { Service } from '@lowerdeck/service';
import { getRegional, type SandboxMachineWithTenant } from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';

class SandboxMachineOperationServiceImpl {
  list(d: { machine: SandboxMachineWithTenant; instanceId?: string }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let machineId = d.machine.id;

    if (d.instanceId) {
      let instanceId = d.instanceId;

      return createRemotePaginator(page =>
        genesis.machine.instance.operation.list({ tenantId, machineId, instanceId, ...page })
      );
    }

    return createRemotePaginator(page =>
      genesis.machine.operation.list({ tenantId, machineId, ...page })
    );
  }

  async get(d: {
    machine: SandboxMachineWithTenant;
    instanceId?: string;
    operationId: string;
  }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let machineId = d.machine.id;

    if (d.instanceId) {
      return await genesis.machine.instance.operation.get({
        tenantId,
        machineId,
        instanceId: d.instanceId,
        operationId: d.operationId
      });
    }

    return await genesis.machine.operation.get({
      tenantId,
      machineId,
      operationId: d.operationId
    });
  }
}

export let sandboxMachineOperationService = Service.create(
  'sandboxMachineOperationService',
  () => new SandboxMachineOperationServiceImpl()
).build();
