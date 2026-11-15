import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  ID,
  type Instance,
  type SandboxEgressPolicy,
  type SandboxEgressPolicyRegion
} from '@metorial/db';
import { createLock } from '@metorial/lock';
import {
  compileEgressRules,
  EgressCompileError,
  hashEgressRules,
  hashFirewallSet
} from '@metorial/module-networking';
import { getRegional, type SandboxTenantWithRegion } from '../lib/regional';

let compileLock = createLock({ name: 'sbx/egress/compile' });

let policyInclude = {
  firewalls: {
    orderBy: { position: 'asc' },
    include: {
      firewall: {
        include: {
          networkPolicyLinks: {
            orderBy: { position: 'asc' },
            include: { networkPolicy: { include: { currentVersion: true } } }
          }
        }
      }
    }
  }
} as const;

let invalidPolicy = (message: string) =>
  new ServiceError(badRequestError({ code: 'invalid_egress_policy', message }));

class SandboxEgressPolicyInternalServiceImpl {
  async resolve(d: { instance: Instance; firewallIds: string[] }) {
    let firewallIds = [...new Set(d.firewallIds)];
    if (!firewallIds.length) return null;

    let firewalls = await db.firewall.findMany({
      where: { id: { in: firewallIds }, instanceOid: d.instance.oid, status: 'active' }
    });
    if (firewalls.length != firewallIds.length) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_firewalls',
          message: 'Every firewall must exist and be active in this instance.'
        })
      );
    }

    let firewallSetHash = await hashFirewallSet(firewallIds);

    let policy = await this.findOrCreate({
      instance: d.instance,
      firewallSetHash,
      firewalls,
      firewallIds
    });

    let compiled = await this.compile({ policyOid: policy.oid });
    if (compiled.status == 'invalid') throw invalidPolicy(compiled.error);

    return await db.sandboxEgressPolicy.findUniqueOrThrow({ where: { oid: policy.oid } });
  }

  private async findOrCreate(d: {
    instance: Instance;
    firewallSetHash: string;
    firewalls: { oid: bigint; id: string }[];
    firewallIds: string[];
  }) {
    let find = () =>
      db.sandboxEgressPolicy.findFirst({
        where: { instanceOid: d.instance.oid, firewallSetHash: d.firewallSetHash }
      });

    let existing = await find();
    if (existing) {
      if (existing.unusedAt) {
        await db.sandboxEgressPolicy.update({
          where: { oid: existing.oid },
          data: { unusedAt: null }
        });
      }

      return existing;
    }

    let byId = new Map(d.firewalls.map(firewall => [firewall.id, firewall]));

    try {
      return await db.sandboxEgressPolicy.create({
        data: {
          id: await ID.generateId('sandboxEgressPolicy'),
          firewallSetHash: d.firewallSetHash,
          organizationOid: d.instance.organizationOid,
          projectOid: d.instance.projectOid,
          instanceOid: d.instance.oid,
          firewalls: {
            create: await Promise.all(
              d.firewallIds.map(async (firewallId, position) => ({
                id: await ID.generateId('sandboxEgressPolicyFirewall'),
                position,
                firewallOid: byId.get(firewallId)!.oid
              }))
            )
          }
        }
      });
    } catch (err) {
      let concurrent = await find();
      if (concurrent) return concurrent;

      throw err;
    }
  }

  async compile(d: {
    policyOid: bigint;
  }): Promise<
    | { status: 'active'; changed: boolean; policy: SandboxEgressPolicy }
    | { status: 'invalid'; error: string }
  > {
    return await compileLock.usingLock([d.policyOid.toString()], async () => {
      let policy = await db.sandboxEgressPolicy.findUniqueOrThrow({
        where: { oid: d.policyOid },
        include: policyInclude
      });

      let inputs = policy.firewalls.map(link => ({
        policies:
          link.firewall.status == 'active'
            ? link.firewall.networkPolicyLinks
                .filter(policyLink => policyLink.networkPolicy.status == 'active')
                .map(policyLink => ({
                  rules: policyLink.networkPolicy.currentVersion?.rules ?? []
                }))
            : []
      }));

      let compiled;
      try {
        compiled = compileEgressRules({ firewalls: inputs });
      } catch (err) {
        if (!(err instanceof EgressCompileError)) throw err;

        await db.sandboxEgressPolicy.update({
          where: { oid: policy.oid },
          data: { status: 'invalid', lastError: err.message, needsCompile: false }
        });

        return { status: 'invalid' as const, error: err.message };
      }

      let rulesHash = await hashEgressRules(compiled.rules);

      if (policy.status == 'active' && policy.rulesHash == rulesHash) {
        let unchanged = await db.sandboxEgressPolicy.update({
          where: { oid: policy.oid },
          data: { needsCompile: false, warnings: compiled.warnings }
        });

        return { status: 'active' as const, changed: false, policy: unchanged };
      }

      let updated = await db.sandboxEgressPolicy.update({
        where: { oid: policy.oid },
        data: {
          status: 'active',
          rules: compiled.rules,
          rulesHash,
          revision: { increment: 1 },
          warnings: compiled.warnings,
          lastError: null,
          needsCompile: false,
          compiledAt: new Date()
        }
      });

      return { status: 'active' as const, changed: true, policy: updated };
    });
  }

  async ensureRegion(d: { policy: SandboxEgressPolicy; tenant: SandboxTenantWithRegion }) {
    let region = await db.sandboxEgressPolicyRegion.upsert({
      where: { policyOid_tenantOid: { policyOid: d.policy.oid, tenantOid: d.tenant.oid } },
      update: {},
      create: {
        id: await ID.generateId('sandboxEgressPolicyRegion'),
        policyOid: d.policy.oid,
        tenantOid: d.tenant.oid
      }
    });

    return await this.syncRegion({ regionOid: region.oid });
  }

  async syncRegion(d: { regionOid: bigint }): Promise<SandboxEgressPolicyRegion> {
    let region = await db.sandboxEgressPolicyRegion.findUniqueOrThrow({
      where: { oid: d.regionOid },
      include: { policy: true, tenant: { include: { region: true } } }
    });

    let { policy } = region;
    if (policy.status != 'active') {
      throw invalidPolicy(policy.lastError ?? 'The egress policy has not been compiled.');
    }

    let upToDate =
      region.status == 'synced' &&
      region.genesisId &&
      region.syncedRevision >= policy.revision;
    if (upToDate) return region;

    let { genesis, tenantId } = getRegional(region.tenant);

    try {
      let remote = await genesis.egressPolicy.upsert({
        tenantId,
        name: policy.id,
        rules: (policy.rules ?? []) as never
      });

      let synced = await db.sandboxEgressPolicyRegion.update({
        where: { oid: region.oid },
        data: {
          status: 'synced',
          genesisId: remote.id,
          syncedRevision: Math.max(region.syncedRevision, policy.revision),
          attempt: 0,
          nextAttemptAt: null,
          failureMessage: null,
          lastSyncedAt: new Date()
        }
      });

      let latest = await db.sandboxEgressPolicy.findUniqueOrThrow({
        where: { oid: policy.oid },
        select: { revision: true }
      });
      if (latest.revision > policy.revision) return await this.syncRegion(d);

      return synced;
    } catch (err) {
      await db.sandboxEgressPolicyRegion.update({
        where: { oid: region.oid },
        data: {
          status: 'failed',
          attempt: { increment: 1 },
          failureMessage: err instanceof Error ? err.message : String(err)
        }
      });

      throw err;
    }
  }
}

export let sandboxEgressPolicyInternalService = Service.create(
  'sandboxEgressPolicyInternalService',
  () => new SandboxEgressPolicyInternalServiceImpl()
).build();
