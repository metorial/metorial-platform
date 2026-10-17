import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Fabric } from '@metorial/fabric';
import { toAuditMachine } from '../lib/audit';
import {
  assertMachineActive,
  getRegional,
  type SandboxMachineWithTenant
} from '../lib/regional';

class SandboxMachineAccessServiceImpl {
  private async createToken(d: {
    machine: SandboxMachineWithTenant;
    auditScope: AuditScope;
    scope: 'shell' | 'files' | 'port';
    ports?: number[] | '*';
    ttlSeconds?: number;
  }) {
    assertMachineActive(d.machine);

    let { genesis, tenantId } = getRegional(d.machine.tenant);

    let token = await genesis.machine.access.createToken({
      tenantId,
      machineId: d.machine.id,
      scope: d.scope,
      ports: d.ports,
      ttlSeconds: d.ttlSeconds
    });

    await Fabric.fire('sandbox.machine.access.created:after', {
      auditScope: d.auditScope,
      machine: toAuditMachine(d.machine),
      kind: d.scope,
      ports: d.ports ?? null,
      ttlSeconds: d.ttlSeconds ?? null
    });

    return token;
  }

  async createShellAccess(d: {
    machine: SandboxMachineWithTenant;
    auditScope: AuditScope;
    input?: { ttlSeconds?: number };
  }) {
    return await this.createToken({
      machine: d.machine,
      auditScope: d.auditScope,
      scope: 'shell',
      ttlSeconds: d.input?.ttlSeconds
    });
  }

  async createFilesAccess(d: {
    machine: SandboxMachineWithTenant;
    auditScope: AuditScope;
    input?: { ttlSeconds?: number };
  }) {
    return await this.createToken({
      machine: d.machine,
      auditScope: d.auditScope,
      scope: 'files',
      ttlSeconds: d.input?.ttlSeconds
    });
  }

  async createPortAccess(d: {
    machine: SandboxMachineWithTenant;
    auditScope: AuditScope;
    input: { ports: number[] | '*'; ttlSeconds?: number };
  }) {
    return await this.createToken({
      machine: d.machine,
      auditScope: d.auditScope,
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
