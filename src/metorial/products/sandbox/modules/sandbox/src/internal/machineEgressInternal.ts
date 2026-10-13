import { Service } from '@lowerdeck/service';
import {
  db,
  ID,
  withTransaction,
  type Instance,
  type SandboxEgressPolicy,
  type SandboxEgressPolicyRegion,
  type SandboxMachine
} from '@metorial/db';
import {
  assertMachineActive,
  getRegional,
  type SandboxTenantWithRegion
} from '../lib/regional';
import { sandboxEgressPolicyInternalService } from './egressPolicyInternal';

type PreparedEgress = {
  policy: SandboxEgressPolicy | null;
  region: SandboxEgressPolicyRegion | null;
};

class SandboxMachineEgressInternalServiceImpl {
  async prepare(d: {
    instance: Instance;
    tenant: SandboxTenantWithRegion;
    firewallIds: string[];
  }): Promise<PreparedEgress> {
    let policy = await sandboxEgressPolicyInternalService.resolve({
      instance: d.instance,
      firewallIds: d.firewallIds
    });
    if (!policy) return { policy: null, region: null };

    let region = await sandboxEgressPolicyInternalService.ensureRegion({
      policy,
      tenant: d.tenant
    });

    return { policy, region };
  }

  async attach(d: {
    machine: SandboxMachine;
    firewallIds: string[];
    prepared: PreparedEgress;
    applied: boolean;
  }) {
    await withTransaction(async tx => {
      await this.replaceLinks({ machineOid: d.machine.oid, firewallIds: d.firewallIds });

      await tx.sandboxMachine.update({
        where: { oid: d.machine.oid },
        data: {
          egressPolicyOid: d.prepared.policy?.oid ?? null,
          appliedEgressRegionOid: d.applied ? (d.prepared.region?.oid ?? null) : undefined,
          needsEgressSync: !d.applied,
          egressSyncAttempt: 0,
          egressSyncError: null
        }
      });
    });
  }

  async setFirewalls(d: {
    machine: SandboxMachine & { instance: Instance; tenant: SandboxTenantWithRegion };
    firewallIds: string[];
  }) {
    assertMachineActive(d.machine);

    let policy = await sandboxEgressPolicyInternalService.resolve({
      instance: d.machine.instance,
      firewallIds: d.firewallIds
    });

    await this.attach({
      machine: d.machine,
      firewallIds: [...new Set(d.firewallIds)],
      prepared: { policy, region: null },
      applied: false
    });

    try {
      await this.sync({ machineOid: d.machine.oid });
    } catch {
      // The failure is recorded on the machine and the reconcile cron retries it.
    }
  }

  async sync(d: { machineOid: bigint }): Promise<void> {
    let machine = await db.sandboxMachine.findUnique({
      where: { oid: d.machineOid },
      include: { tenant: { include: { region: true } }, egressPolicy: true }
    });
    if (!machine || machine.status != 'active' || !machine.needsEgressSync) return;

    try {
      let region = machine.egressPolicy
        ? await sandboxEgressPolicyInternalService.ensureRegion({
            policy: machine.egressPolicy,
            tenant: machine.tenant
          })
        : null;

      let { genesis, tenantId } = getRegional(machine.tenant);
      await genesis.machine.update({
        tenantId,
        machineId: machine.id,
        egressPolicyId: region?.genesisId ?? null
      });

      let applied = await db.sandboxMachine.updateMany({
        where: { oid: machine.oid, egressPolicyOid: machine.egressPolicyOid },
        data: {
          appliedEgressRegionOid: region?.oid ?? null,
          needsEgressSync: false,
          egressSyncAttempt: 0,
          egressSyncError: null
        }
      });

      if (applied.count == 0) return await this.sync(d);
    } catch (err) {
      await db.sandboxMachine.update({
        where: { oid: machine.oid },
        data: {
          egressSyncAttempt: { increment: 1 },
          egressSyncError: err instanceof Error ? err.message : String(err)
        }
      });

      throw err;
    }
  }

  private async replaceLinks(d: { machineOid: bigint; firewallIds: string[] }) {
    await withTransaction(
      async tx => {
        await tx.sandboxMachineFirewall.deleteMany({ where: { machineOid: d.machineOid } });
        if (!d.firewallIds.length) return;

        let firewalls = await tx.firewall.findMany({
          where: { id: { in: d.firewallIds } },
          select: { oid: true, id: true }
        });
        let byId = new Map(firewalls.map(firewall => [firewall.id, firewall.oid]));

        for (let [position, firewallId] of d.firewallIds.entries()) {
          await tx.sandboxMachineFirewall.create({
            data: {
              id: await ID.generateId('sandboxMachineFirewall'),
              position,
              machineOid: d.machineOid,
              firewallOid: byId.get(firewallId)!
            }
          });
        }
      },
      { ifExists: true }
    );
  }
}

export let sandboxMachineEgressInternalService = Service.create(
  'sandboxMachineEgressInternalService',
  () => new SandboxMachineEgressInternalServiceImpl()
).build();
