import { Service } from '@lowerdeck/service';
import {
  assertMachineActive,
  getRegional,
  type SandboxMachineWithTenant
} from '../lib/regional';

class SandboxMachineAccessServiceImpl {
  private async createToken(d: {
    machine: SandboxMachineWithTenant;
    scope: 'shell' | 'files' | 'port';
    ports?: number[] | '*';
    ttlSeconds?: number;
  }) {
    assertMachineActive(d.machine);

    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return await genesis.machine.access.createToken({
      tenantId,
      machineId: d.machine.id,
      scope: d.scope,
      ports: d.ports,
      ttlSeconds: d.ttlSeconds
    });
  }

  async createShellAccess(d: {
    machine: SandboxMachineWithTenant;
    input?: { ttlSeconds?: number };
  }) {
    return await this.createToken({
      machine: d.machine,
      scope: 'shell',
      ttlSeconds: d.input?.ttlSeconds
    });
  }

  async createFilesAccess(d: {
    machine: SandboxMachineWithTenant;
    input?: { ttlSeconds?: number };
  }) {
    return await this.createToken({
      machine: d.machine,
      scope: 'files',
      ttlSeconds: d.input?.ttlSeconds
    });
  }

  async createPortAccess(d: {
    machine: SandboxMachineWithTenant;
    input: { ports: number[] | '*'; ttlSeconds?: number };
  }) {
    return await this.createToken({
      machine: d.machine,
      scope: 'port',
      ports: d.input.ports,
      ttlSeconds: d.input.ttlSeconds
    });
  }
}

export let sandboxMachineAccessService = Service.create(
  'sandboxMachineAccessService',
  () => new SandboxMachineAccessServiceImpl()
).build();
