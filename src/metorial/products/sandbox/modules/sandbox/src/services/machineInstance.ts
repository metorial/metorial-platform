import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { createRemotePaginator } from '../lib/remotePaginator';
import { getRegional, type SandboxMachineWithTenant } from '../lib/regional';
import { getRegionClient } from '../lib/regions';

class SandboxMachineInstanceServiceImpl {
  list(d: { machine: SandboxMachineWithTenant }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return createRemotePaginator(page =>
      genesis.machine.instance.list({ tenantId, machineId: d.machine.id, ...page })
    );
  }

  async get(d: { machine: SandboxMachineWithTenant; instanceId: string }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return await genesis.machine.instance.get({
      tenantId,
      machineId: d.machine.id,
      instanceId: d.instanceId
    });
  }

  async logs(d: {
    machine: SandboxMachineWithTenant;
    instanceId: string;
    input: { direction?: 'forward' | 'backward'; cursor?: number; limit?: number };
  }) {
    let instance = await this.get({ machine: d.machine, instanceId: d.instanceId });
    if (!instance.logStreamId) {
      throw new ServiceError(notFoundError('sandbox_log_stream', d.instanceId));
    }

    return await getRegionClient(d.machine.tenant.region.id).logStream.lines({
      tenantId: d.machine.tenant.id,
      logStreamId: instance.logStreamId,
      ...d.input
    });
  }
}

export let sandboxMachineInstanceService = Service.create(
  'sandboxMachineInstanceService',
  () => new SandboxMachineInstanceServiceImpl()
).build();
