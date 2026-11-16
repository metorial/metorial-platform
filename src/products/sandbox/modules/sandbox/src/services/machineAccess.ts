import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Fabric } from '@metorial/fabric';
import { toAuditMachine } from '../lib/audit';
import {
  machineExecDefaultTimeoutSeconds,
  MachineExecError,
  type MachineExecOutcome,
  type MachineExecResult,
  runMachineExec
} from '../lib/machineExec';
import {
  assertMachineActive,
  getRegional,
  type SandboxMachineWithTenant
} from '../lib/regional';

let execWakeMarginSeconds = 120;

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

  async execCommand(d: {
    machine: SandboxMachineWithTenant;
    auditScope: AuditScope;
    input: {
      command: string;
      cwd?: string;
      env?: Record<string, string>;
      timeoutSeconds?: number;
    };
    signal?: AbortSignal;
  }) {
    let timeoutSeconds = d.input.timeoutSeconds ?? machineExecDefaultTimeoutSeconds;
    let deadlineSeconds = timeoutSeconds + execWakeMarginSeconds;

    let access = await this.createToken({
      machine: d.machine,
      auditScope: d.auditScope,
      scope: 'shell',
      ttlSeconds: deadlineSeconds
    });

    let startedAt = Date.now();
    let outcome: MachineExecOutcome = 'rejected';
    let result: MachineExecResult | null = null;

    try {
      result = await runMachineExec({
        url: access.urls.exec,
        token: access.token,
        command: d.input.command,
        cwd: d.input.cwd,
        env: d.input.env,
        timeoutMs: timeoutSeconds * 1000,
        deadlineMs: deadlineSeconds * 1000,
        signal: d.signal
      });
      outcome = 'exited';

      return result;
    } catch (error) {
      if (error instanceof MachineExecError) outcome = error.outcome;
      throw error;
    } finally {
      await Fabric.fire('sandbox.machine.exec:after', {
        auditScope: d.auditScope,
        machine: toAuditMachine(d.machine),
        commandByteSize: Buffer.byteLength(d.input.command),
        outcome,
        exitCode: result?.exitCode ?? null,
        timedOut: result?.timedOut ?? false,
        durationMs: Date.now() - startedAt
      });
    }
  }
}

export let sandboxMachineAccessService = Service.create(
  'sandboxMachineAccessService',
  () => new SandboxMachineAccessServiceImpl()
).build();
