import { Service } from '@lowerdeck/service';
import {
  getRegional,
  type SandboxInstanceOperationFilter,
  type SandboxMachineOperationFilter,
  type SandboxMachineWithTenant
} from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';

class SandboxMachineOperationServiceImpl {
  list(d: {
    machine: SandboxMachineWithTenant;
    instanceId?: string;
    kinds?: (
      | NonNullable<SandboxMachineOperationFilter['kinds']>[number]
      | NonNullable<SandboxInstanceOperationFilter['kinds']>[number]
    )[];
    triggers?: (
      | NonNullable<SandboxMachineOperationFilter['triggers']>[number]
      | NonNullable<SandboxInstanceOperationFilter['triggers']>[number]
    )[];
    outcomes?: (
      | NonNullable<SandboxMachineOperationFilter['outcomes']>[number]
      | NonNullable<SandboxInstanceOperationFilter['outcomes']>[number]
    )[];
  }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let machineId = d.machine.id;

    if (d.instanceId) {
      let instanceId = d.instanceId;

      return createRemotePaginator(page =>
        genesis.machine.instance.operation.list({
          tenantId,
          machineId,
          instanceId,
          kinds: d.kinds as SandboxInstanceOperationFilter['kinds'],
          triggers: d.triggers as SandboxInstanceOperationFilter['triggers'],
          outcomes: d.outcomes as SandboxInstanceOperationFilter['outcomes'],
          ...page
        })
      );
    }

    return createRemotePaginator(page =>
      genesis.machine.operation.list({
        tenantId,
        machineId,
        kinds: d.kinds as SandboxMachineOperationFilter['kinds'],
        triggers: d.triggers as SandboxMachineOperationFilter['triggers'],
        outcomes: d.outcomes as SandboxMachineOperationFilter['outcomes'],
        ...page
      })
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
