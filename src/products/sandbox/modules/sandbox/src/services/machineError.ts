import { Service } from '@lowerdeck/service';
import { getRegional, type SandboxMachineWithTenant } from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';

class SandboxMachineErrorServiceImpl {
  list(d: { machine: SandboxMachineWithTenant; instanceIds?: string[] }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return createRemotePaginator(page =>
      genesis.machine.guestError.list({
        tenantId,
        machineId: d.machine.id,
        instanceIds: d.instanceIds,
        ...page
      })
    );
  }

  async get(d: { machine: SandboxMachineWithTenant; errorId: string }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return await genesis.machine.guestError.get({
      tenantId,
      machineId: d.machine.id,
      errorId: d.errorId
    });
  }
}

export let sandboxMachineErrorService = Service.create(
  'sandboxMachineErrorService',
  () => new SandboxMachineErrorServiceImpl()
).build();
