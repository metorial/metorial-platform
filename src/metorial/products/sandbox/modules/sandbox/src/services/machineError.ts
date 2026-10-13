import { Service } from '@lowerdeck/service';
import { getRegional, type SandboxMachineWithTenant } from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';

class SandboxMachineErrorServiceImpl {
  list(d: { machine: SandboxMachineWithTenant; instanceId?: string }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let machineId = d.machine.id;

    if (d.instanceId) {
      let instanceId = d.instanceId;

      return createRemotePaginator(page =>
        genesis.machine.instance.guestError.list({ tenantId, machineId, instanceId, ...page })
      );
    }

    return createRemotePaginator(page =>
      genesis.machine.guestError.list({ tenantId, machineId, ...page })
    );
  }

  async get(d: { machine: SandboxMachineWithTenant; instanceId?: string; errorId: string }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let machineId = d.machine.id;

    if (d.instanceId) {
      return await genesis.machine.instance.guestError.get({
        tenantId,
        machineId,
        instanceId: d.instanceId,
        errorId: d.errorId
      });
    }

    return await genesis.machine.guestError.get({
      tenantId,
      machineId,
      errorId: d.errorId
    });
  }
}

export let sandboxMachineErrorService = Service.create(
  'sandboxMachineErrorService',
  () => new SandboxMachineErrorServiceImpl()
).build();
