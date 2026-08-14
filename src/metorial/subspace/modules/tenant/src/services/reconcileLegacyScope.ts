import { Service } from '@lowerdeck/service';
import { db as subspaceDb, withTransaction, type TransactionDB } from '@metorial-subspace/db';
import {
  getProjectScopeDrift,
  isCanonicalProjectIdentifier,
  parseCanonicalInstanceOid,
  resolveInstanceForEnvironment
} from '../lib/legacyScope';
import { metorialDb } from '../lib/metorialDb';
import { ensureInstanceMirror } from '../lib/mirrorRecords';
import {
  getInstanceInternalEnvironmentIdentifier,
  getProjectInternalTenantIdentifier
} from '../lib/scopeIds';
import {
  getEnvironmentScopedModels,
  getTenantScopedOnlyModels
} from '../lib/tenantScopedReferences';
import { metorialResourceService } from './metorialResource';
import { reconcileResourceLinksService } from './reconcileResourceLinks';

let TRANSACTION_TIMEOUT_MS = 120_000;
let TRANSACTION_MAX_WAIT_MS = 30_000;

/** Thrown when the legacy state is too ambiguous to repair without losing data. */
export class LegacyScopeAbort extends Error {}

type TenantCandidate = {
  oid: bigint;
  id: string;
  identifier: string;
  resourceTenantId: string | null;
  resourceTenantIdentifier: string | null;
  projectOid: bigint | null;
  retiredAt: Date | null;
};

type EnvironmentCandidate = {
  oid: bigint;
  id: string;
  identifier: string;
  tenantOid: bigint;
  resourceGroupId: string | null;
  resourceGroupIdentifier: string | null;
  instanceOid: bigint | null;
};

type EnvironmentPlan = {
  instanceOid: bigint;
  instanceId: string;
  identifier: string;
  survivor: EnvironmentCandidate;
  duplicates: EnvironmentCandidate[];
  resourceGroupId: string | null;
  resourceGroupIdentifier: string | null;
};

type ScopeProject = {
  oid: bigint;
  id: string;
  subspaceTenantId: string | null;
  resourceTenant: { id: string; identifier: string } | null;
  instances: {
    oid: bigint;
    id: string;
    subspaceTenantId: string | null;
    subspaceEnvironmentId: string | null;
    resourceGroupOid: bigint | null;
  }[];
};

export type LegacyScopeReport = {
  projectOid: string;
  status: 'reconciled' | 'noop' | 'aborted';
  reason?: string;
  tenantIdentifier?: string;
  promotedTenantId?: string;
  renamedTenant: boolean;
  movedEnvironments: string[];
  renamedEnvironments: string[];
  deletedEnvironments: string[];
  retiredTenantIds: string[];
  strandedRows: { tenantId: string; model: string; count: number }[];
  warnings: string[];
  /** Set once the subspace transaction commits, after which failures must not be swallowed. */
  committedAt?: Date;
};

let tenantSelect = {
  oid: true,
  id: true,
  identifier: true,
  resourceTenantId: true,
  resourceTenantIdentifier: true,
  projectOid: true,
  retiredAt: true
};

let environmentSelect = {
  oid: true,
  id: true,
  identifier: true,
  tenantOid: true,
  resourceGroupId: true,
  resourceGroupIdentifier: true,
  instanceOid: true
};

let countEnvironmentChildRows = async (
  environmentOid: bigint,
  client: TransactionDB | typeof subspaceDb = subspaceDb
) => {
  for (let model of getEnvironmentScopedModels()) {
    let count = await (client as any)[model.delegate].count({
      where: { environmentOid }
    });
    if (count > 0) return count;
  }

  return 0;
};

let countTenantScopedOnlyRows = async (tdb: TransactionDB, tenantOid: bigint) => {
  let counts: { model: string; count: number }[] = [];

  for (let model of getTenantScopedOnlyModels()) {
    let count = await (tdb as any)[model.delegate].count({ where: { tenantOid } });
    if (count > 0) counts.push({ model: model.model, count });
  }

  return counts;
};

let collectEnvironmentCandidates = async (instances: ScopeProject['instances']) => {
  let canonicalIdentifiers = instances.map(instance =>
    getInstanceInternalEnvironmentIdentifier(instance)
  );

  return await subspaceDb.environment.findMany({
    where: {
      OR: [
        { identifier: { in: canonicalIdentifiers } },
        { identifier: { in: instances.map(instance => `mtei-${instance.id}`) } },
        {
          id: {
            in: instances.flatMap(instance =>
              instance.subspaceEnvironmentId ? [instance.subspaceEnvironmentId] : []
            )
          }
        },
        { instanceOid: { in: instances.map(instance => instance.oid) } },
        { resourceGroupIdentifier: { in: canonicalIdentifiers } }
      ]
    },
    select: environmentSelect
  });
};

let collectTenantCandidates = async (d: {
  projectOid: bigint;
  tenantIdentifier: string;
  subspaceTenantIds: string[];
  instanceIds: string[];
  environmentTenantOids: bigint[];
}) =>
  await subspaceDb.tenant.findMany({
    where: {
      OR: [
        { identifier: d.tenantIdentifier },
        { identifier: { in: d.instanceIds.map(instanceId => `mte-${instanceId}`) } },
        { id: { in: d.subspaceTenantIds } },
        { resourceTenantIdentifier: d.tenantIdentifier },
        { projectOid: d.projectOid },
        { oid: { in: d.environmentTenantOids } }
      ]
    },
    select: tenantSelect
  });

let pickSurvivorEnvironment = async (d: {
  candidates: EnvironmentCandidate[];
  identifier: string;
}) => {
  if (d.candidates.length === 1) {
    return { survivor: d.candidates[0]!, duplicates: [] as EnvironmentCandidate[] };
  }

  let counted = await Promise.all(
    d.candidates.map(async candidate => ({
      candidate,
      childRows: await countEnvironmentChildRows(candidate.oid)
    }))
  );

  let populated = counted.filter(entry => entry.childRows > 0);
  if (populated.length > 1) {
    throw new LegacyScopeAbort(
      `Environments ${populated
        .map(entry => entry.candidate.id)
        .join(', ')} all hold rows for ${d.identifier}`
    );
  }

  let survivor =
    populated[0]?.candidate ??
    counted.find(entry => entry.candidate.identifier === d.identifier)?.candidate ??
    [...counted].sort((a, b) => (a.candidate.oid < b.candidate.oid ? -1 : 1))[0]!.candidate;

  return {
    survivor,
    duplicates: d.candidates.filter(candidate => candidate.oid !== survivor.oid)
  };
};

let pickSurvivorTenant = (d: {
  candidates: TenantCandidate[];
  identifier: string;
  environmentPlans: EnvironmentPlan[];
}) => {
  let canonical = d.candidates.find(candidate => candidate.identifier === d.identifier);
  if (canonical) return canonical;

  let ownedEnvironments = new Map<bigint, number>();
  for (let plan of d.environmentPlans) {
    ownedEnvironments.set(
      plan.survivor.tenantOid,
      (ownedEnvironments.get(plan.survivor.tenantOid) ?? 0) + 1
    );
  }

  return [...d.candidates].sort((a, b) => {
    let owned = (ownedEnvironments.get(b.oid) ?? 0) - (ownedEnvironments.get(a.oid) ?? 0);
    if (owned !== 0) return owned;
    return a.oid < b.oid ? -1 : 1;
  })[0];
};

let assertTenantHoldsNoForeignEnvironments = async (d: {
  tdb: TransactionDB;
  project: ScopeProject;
  survivorTenant: TenantCandidate;
  environmentPlans: EnvironmentPlan[];
  warnings: string[];
}) => {
  let planned = new Set(d.environmentPlans.map(plan => plan.survivor.oid));

  let environments = await d.tdb.environment.findMany({
    where: { tenantOid: d.survivorTenant.oid },
    select: environmentSelect
  });

  for (let environment of environments) {
    if (planned.has(environment.oid)) continue;

    let resolution = await resolveInstanceForEnvironment(environment);
    if (resolution.status === 'unresolved') {
      d.warnings.push(resolution.reason);
      continue;
    }

    if (resolution.value.projectOid !== d.project.oid) {
      throw new LegacyScopeAbort(
        `Tenant ${d.survivorTenant.id} also holds environment ${environment.id}, which belongs to another project`
      );
    }
  }
};

let moveEnvironmentScopedRows = async (d: {
  tdb: TransactionDB;
  environmentOid: bigint;
  tenantOid: bigint;
}) => {
  for (let model of getEnvironmentScopedModels()) {
    if (!model.hasTenantOid) continue;

    try {
      await (d.tdb as any)[model.delegate].updateMany({
        where: { environmentOid: d.environmentOid, tenantOid: { not: d.tenantOid } },
        data: { tenantOid: d.tenantOid }
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;

      throw new LegacyScopeAbort(
        `Moving ${model.model} rows collides with existing rows under the target tenant (${error.meta?.target ?? 'unknown constraint'})`
      );
    }
  }

  let movedCredentials = await d.tdb.providerAuthCredentials.findMany({
    where: { environmentOid: d.environmentOid },
    select: { oid: true }
  });

  if (movedCredentials.length > 0) {
    await d.tdb.managedProviderAuthCredentialsBacking.updateMany({
      where: {
        providerAuthCredentialsOid: { in: movedCredentials.map(row => row.oid) },
        tenantOid: { not: d.tenantOid }
      },
      data: { tenantOid: d.tenantOid }
    });
  }
};

let remapEnvironmentActors = async (d: {
  tdb: TransactionDB;
  environmentOid: bigint;
  fromTenantOid: bigint;
  toTenantOid: bigint;
  warnings: string[];
}) => {
  let alerts = await d.tdb.monitorAlert.findMany({
    where: { environmentOid: d.environmentOid },
    select: { oid: true }
  });
  if (alerts.length === 0) return;

  let monitorAlertOids = alerts.map(alert => alert.oid);

  let events = await d.tdb.monitorAlertEvent.findMany({
    where: { monitorAlertOid: { in: monitorAlertOids }, actorOid: { not: null } },
    select: { actorOid: true },
    distinct: ['actorOid']
  });
  let recipients = await d.tdb.monitorAlertRecipient.findMany({
    where: { monitorAlertOid: { in: monitorAlertOids } },
    select: { recipientOid: true },
    distinct: ['recipientOid']
  });

  let referenced = [
    ...new Set([
      ...events.flatMap(event => (event.actorOid === null ? [] : [event.actorOid])),
      ...recipients.map(recipient => recipient.recipientOid)
    ])
  ];
  if (referenced.length === 0) return;

  let actors = await d.tdb.tenantActor.findMany({
    where: { tenantOid: d.fromTenantOid, oid: { in: referenced } },
    select: { oid: true, identifier: true }
  });
  if (actors.length === 0) return;

  let replacements = await d.tdb.tenantActor.findMany({
    where: {
      tenantOid: d.toTenantOid,
      identifier: { in: actors.map(actor => actor.identifier) }
    },
    select: { oid: true, identifier: true }
  });
  let replacementByIdentifier = new Map(
    replacements.map(actor => [actor.identifier, actor.oid])
  );

  for (let actor of actors) {
    let replacement = replacementByIdentifier.get(actor.identifier);

    if (replacement === undefined) {
      d.warnings.push(
        `Actor ${actor.identifier} has no counterpart under tenant ${d.toTenantOid}, monitor alert references left in place`
      );
      continue;
    }

    await d.tdb.monitorAlertEvent.updateMany({
      where: { monitorAlertOid: { in: monitorAlertOids }, actorOid: actor.oid },
      data: { actorOid: replacement }
    });

    let alreadyPresent = await d.tdb.monitorAlertRecipient.findMany({
      where: { monitorAlertOid: { in: monitorAlertOids }, recipientOid: replacement },
      select: { monitorAlertOid: true }
    });

    if (alreadyPresent.length > 0) {
      await d.tdb.monitorAlertRecipient.deleteMany({
        where: {
          monitorAlertOid: { in: alreadyPresent.map(entry => entry.monitorAlertOid) },
          recipientOid: actor.oid
        }
      });
    }

    await d.tdb.monitorAlertRecipient.updateMany({
      where: { monitorAlertOid: { in: monitorAlertOids }, recipientOid: actor.oid },
      data: { recipientOid: replacement }
    });
  }
};

class ReconcileLegacyScopeServiceImpl {
  async reconcileLegacyProjectScope(d: { projectOid: bigint }): Promise<LegacyScopeReport> {
    let report: LegacyScopeReport = {
      projectOid: d.projectOid.toString(),
      status: 'noop',
      renamedTenant: false,
      movedEnvironments: [],
      renamedEnvironments: [],
      deletedEnvironments: [],
      retiredTenantIds: [],
      strandedRows: [],
      warnings: []
    };

    try {
      return await this.run(d.projectOid, report);
    } catch (error: any) {
      if (report.committedAt) throw error;

      if (error instanceof LegacyScopeAbort) {
        return { ...report, status: 'aborted', reason: error.message };
      }

      if (error?.code === 'P2002') {
        return {
          ...report,
          status: 'aborted',
          reason: `Canonical identifier collision: ${error.meta?.target ?? 'unknown constraint'}`
        };
      }

      throw error;
    }
  }

  private async run(projectOid: bigint, report: LegacyScopeReport) {
    let project = await metorialDb.project.findUnique({
      where: { oid: projectOid },
      include: {
        instances: true,
        resourceTenant: { select: { id: true, identifier: true } }
      }
    });

    if (!project) {
      return { ...report, status: 'aborted' as const, reason: 'Project no longer exists' };
    }

    let tenantIdentifier = getProjectInternalTenantIdentifier(project);
    report.tenantIdentifier = tenantIdentifier;

    let drift = await getProjectScopeDrift({ projectOid });
    report.warnings.push(...drift.reasons, ...drift.notes);

    let { plans: environmentPlans, foreignEnvironmentIds } = await this.planEnvironments({
      project,
      report
    });
    let tenantCandidates = await this.planTenants({
      project,
      tenantIdentifier,
      environmentPlans
    });

    let survivorTenant = pickSurvivorTenant({
      candidates: tenantCandidates,
      identifier: tenantIdentifier,
      environmentPlans
    });

    if (!survivorTenant) {
      if (drift.hasDrift) return await this.clearDanglingLinks({ project, report });

      if (drift.notes.length > 0) {
        return { ...report, status: 'aborted' as const, reason: drift.notes.join('; ') };
      }

      return report;
    }

    // A link to an environment named for another instance reads as a note rather than drift, so
    // nothing else defers on it. Left alone it would keep this instance pointing at a sibling's
    // environment while the regular path provisions a replacement behind it.
    let hasForeignLink = project.instances.some(
      instance =>
        instance.subspaceEnvironmentId &&
        foreignEnvironmentIds.has(instance.subspaceEnvironmentId) &&
        !environmentPlans.some(plan => plan.instanceOid === instance.oid)
    );

    let needsWork =
      drift.hasDrift ||
      hasForeignLink ||
      survivorTenant.identifier !== tenantIdentifier ||
      tenantCandidates.length > 1 ||
      environmentPlans.some(
        plan =>
          plan.survivor.identifier !== plan.identifier ||
          plan.survivor.tenantOid !== survivorTenant.oid ||
          plan.duplicates.length > 0
      );

    if (!needsWork) return report;

    report.promotedTenantId = survivorTenant.id;

    await withTransaction(
      async tdb =>
        await this.apply({
          tdb,
          project,
          tenantIdentifier,
          survivorTenant,
          tenantCandidates,
          environmentPlans,
          report
        }),
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS }
    );

    report.committedAt = new Date();

    let keptExistingLink = await this.persistMetorialLinks({
      project,
      tenantIdentifier,
      survivorTenant,
      environmentPlans,
      foreignEnvironmentIds,
      report
    });

    await this.repairKeptEnvironmentMirrors({ project, keptExistingLink, report });

    await this.handOffToRegularReconciliation({
      projectOid,
      skipInstanceOids: keptExistingLink
    });

    return { ...report, status: 'reconciled' as const };
  }

  private async clearDanglingLinks(d: { project: ScopeProject; report: LegacyScopeReport }) {
    let isDangling = async (subspaceTenantId: string | null) => {
      if (!subspaceTenantId) return false;

      let tenant = await subspaceDb.tenant.findUnique({
        where: { id: subspaceTenantId },
        select: { retiredAt: true }
      });

      return !tenant || !!tenant.retiredAt;
    };

    let cleared = 0;

    if (await isDangling(d.project.subspaceTenantId)) {
      await metorialDb.project.update({
        where: { oid: d.project.oid },
        data: { internalTenantIdentifier: null, subspaceTenantId: null }
      });
      cleared++;
    }

    for (let instance of d.project.instances) {
      let tenantDangling = await isDangling(instance.subspaceTenantId);

      let environmentDangling =
        !!instance.subspaceEnvironmentId &&
        !(await subspaceDb.environment.findUnique({
          where: { id: instance.subspaceEnvironmentId },
          select: { oid: true }
        }));

      if (!tenantDangling && !environmentDangling) continue;

      await metorialDb.instance.update({
        where: { oid: instance.oid },
        data: {
          ...(tenantDangling
            ? { internalTenantIdentifier: null, subspaceTenantId: null }
            : {}),
          ...(environmentDangling
            ? { internalEnvironmentIdentifier: null, subspaceEnvironmentId: null }
            : {})
        }
      });
      cleared++;
    }

    if (cleared === 0) return d.report;

    d.report.warnings.push(`Cleared ${cleared} dangling subspace links`);
    await this.handOffToRegularReconciliation({ projectOid: d.project.oid });

    return { ...d.report, status: 'reconciled' as const };
  }

  private async planEnvironments(d: { project: ScopeProject; report: LegacyScopeReport }) {
    let candidates = await collectEnvironmentCandidates(d.project.instances);

    // A canonical identifier names the instance that owns the environment, so an instance linking
    // to one that names a sibling is holding a link the identifier itself contradicts.
    let foreignEnvironmentIds = new Set(
      candidates
        .filter(candidate => {
          let namedInstanceOid = parseCanonicalInstanceOid(candidate.identifier);
          if (namedInstanceOid === null) return false;

          return d.project.instances.some(
            instance =>
              instance.subspaceEnvironmentId === candidate.id &&
              instance.oid !== namedInstanceOid
          );
        })
        .map(candidate => candidate.id)
    );

    let byInstance = new Map<bigint, EnvironmentCandidate[]>();

    for (let candidate of candidates) {
      let resolution = await resolveInstanceForEnvironment(candidate);

      if (resolution.status === 'unresolved') {
        d.report.warnings.push(resolution.reason);
        continue;
      }

      if (resolution.value.projectOid !== d.project.oid) continue;

      // A canonical identifier names the instance it belongs to, and resolution trusts the mirror
      // before the identifier. When the two disagree the row is another instance's environment
      // reached through a stale pointer, so promoting it would rename or delete a correct row.
      let namedInstanceOid = parseCanonicalInstanceOid(candidate.identifier);
      if (namedInstanceOid !== null && namedInstanceOid !== resolution.value.oid) {
        d.report.warnings.push(
          `Environment ${candidate.id} names instance ${namedInstanceOid} but resolves to instance ${resolution.value.oid}, leaving it alone`
        );
        continue;
      }

      byInstance.set(resolution.value.oid, [
        ...(byInstance.get(resolution.value.oid) ?? []),
        candidate
      ]);
    }

    let plans: EnvironmentPlan[] = [];

    for (let instance of d.project.instances) {
      let instanceCandidates = byInstance.get(instance.oid) ?? [];
      if (instanceCandidates.length === 0) continue;

      if (instanceCandidates.length > 2) {
        throw new LegacyScopeAbort(
          `Instance ${instance.id} has ${instanceCandidates.length} subspace environments`
        );
      }

      let identifier = getInstanceInternalEnvironmentIdentifier(instance);
      let { survivor, duplicates } = await pickSurvivorEnvironment({
        candidates: instanceCandidates,
        identifier
      });

      let resourceGroup = instance.resourceGroupOid
        ? await metorialDb.resourceGroup.findUnique({
            where: { oid: instance.resourceGroupOid },
            select: { id: true, identifier: true }
          })
        : null;

      plans.push({
        instanceOid: instance.oid,
        instanceId: instance.id,
        identifier,
        survivor,
        duplicates,
        resourceGroupId: resourceGroup?.id ?? survivor.resourceGroupId,
        resourceGroupIdentifier: resourceGroup?.identifier ?? survivor.resourceGroupIdentifier
      });
    }

    return { plans, foreignEnvironmentIds };
  }

  private async planTenants(d: {
    project: ScopeProject;
    tenantIdentifier: string;
    environmentPlans: EnvironmentPlan[];
  }) {
    let subspaceTenantIds = [
      d.project.subspaceTenantId,
      ...d.project.instances.map(instance => instance.subspaceTenantId)
    ].filter((id): id is string => !!id);

    let candidates = await collectTenantCandidates({
      projectOid: d.project.oid,
      tenantIdentifier: d.tenantIdentifier,
      subspaceTenantIds,
      instanceIds: d.project.instances.map(instance => instance.id),
      environmentTenantOids: d.environmentPlans.map(plan => plan.survivor.tenantOid)
    });

    return candidates.filter(candidate => {
      if (candidate.retiredAt) return false;

      return (
        candidate.identifier === d.tenantIdentifier ||
        !isCanonicalProjectIdentifier(candidate.identifier)
      );
    });
  }

  private async apply(d: {
    tdb: TransactionDB;
    project: ScopeProject;
    tenantIdentifier: string;
    survivorTenant: TenantCandidate;
    tenantCandidates: TenantCandidate[];
    environmentPlans: EnvironmentPlan[];
    report: LegacyScopeReport;
  }) {
    await assertTenantHoldsNoForeignEnvironments({
      tdb: d.tdb,
      project: d.project,
      survivorTenant: d.survivorTenant,
      environmentPlans: d.environmentPlans,
      warnings: d.report.warnings
    });

    await d.tdb.project.updateMany({
      where: { oid: d.project.oid },
      data: { tenantOid: d.survivorTenant.oid }
    });

    for (let plan of d.environmentPlans) {
      await d.tdb.instance.updateMany({
        where: { oid: plan.instanceOid },
        data: { environmentOid: plan.survivor.oid }
      });

      for (let duplicate of plan.duplicates) {
        let childRows = await countEnvironmentChildRows(duplicate.oid, d.tdb);
        if (childRows > 0) {
          throw new LegacyScopeAbort(
            `Environment ${duplicate.id} gained rows while reconciling ${plan.identifier}`
          );
        }

        let attachedMirrors = await d.tdb.instance.count({
          where: { environmentOid: duplicate.oid }
        });
        if (attachedMirrors > 0) {
          throw new LegacyScopeAbort(
            `Environment ${duplicate.id} still backs ${attachedMirrors} instance mirrors, refusing to delete it`
          );
        }

        await d.tdb.environment.delete({ where: { oid: duplicate.oid } });
        d.report.deletedEnvironments.push(duplicate.id);
      }
    }

    for (let plan of d.environmentPlans) {
      if (plan.survivor.tenantOid !== d.survivorTenant.oid) {
        await moveEnvironmentScopedRows({
          tdb: d.tdb,
          environmentOid: plan.survivor.oid,
          tenantOid: d.survivorTenant.oid
        });
        await remapEnvironmentActors({
          tdb: d.tdb,
          environmentOid: plan.survivor.oid,
          fromTenantOid: plan.survivor.tenantOid,
          toTenantOid: d.survivorTenant.oid,
          warnings: d.report.warnings
        });
        d.report.movedEnvironments.push(plan.survivor.id);
      }

      if (plan.survivor.identifier !== plan.identifier) {
        d.report.renamedEnvironments.push(plan.survivor.id);
      }

      await d.tdb.environment.update({
        where: { oid: plan.survivor.oid },
        data: {
          identifier: plan.identifier,
          tenantOid: d.survivorTenant.oid,
          instanceOid: plan.instanceOid,
          resourceGroupId: plan.resourceGroupId,
          resourceGroupIdentifier: plan.resourceGroupIdentifier
        }
      });
    }

    d.report.renamedTenant = d.survivorTenant.identifier !== d.tenantIdentifier;

    await d.tdb.tenant.update({
      where: { oid: d.survivorTenant.oid },
      data: {
        identifier: d.tenantIdentifier,
        projectOid: d.project.oid,
        resourceTenantId: d.project.resourceTenant?.id ?? d.survivorTenant.resourceTenantId,
        resourceTenantIdentifier:
          d.project.resourceTenant?.identifier ?? d.survivorTenant.resourceTenantIdentifier
      }
    });

    for (let candidate of d.tenantCandidates) {
      if (candidate.oid === d.survivorTenant.oid) continue;

      let remainingEnvironments = await d.tdb.environment.count({
        where: { tenantOid: candidate.oid }
      });

      if (remainingEnvironments > 0) {
        d.report.warnings.push(
          `Tenant ${candidate.id} still owns ${remainingEnvironments} environments, leaving it alone`
        );
        continue;
      }

      let stranded = await countTenantScopedOnlyRows(d.tdb, candidate.oid);
      d.report.strandedRows.push(
        ...stranded.map(entry => ({ tenantId: candidate.id, ...entry }))
      );

      await d.tdb.tenant.update({
        where: { oid: candidate.oid },
        data: { retiredAt: new Date() }
      });
      d.report.retiredTenantIds.push(candidate.id);
    }
  }

  private async persistMetorialLinks(d: {
    project: ScopeProject;
    tenantIdentifier: string;
    survivorTenant: TenantCandidate;
    environmentPlans: EnvironmentPlan[];
    foreignEnvironmentIds: Set<string>;
    report: LegacyScopeReport;
  }) {
    await metorialDb.project.update({
      where: { oid: d.project.oid },
      data: {
        internalTenantIdentifier: d.tenantIdentifier,
        subspaceTenantId: d.survivorTenant.id
      }
    });

    let planByInstance = new Map(d.environmentPlans.map(plan => [plan.instanceOid, plan]));
    let keptExistingLink = new Set<bigint>();
    let clearedForeignLink = new Set<bigint>();

    for (let instance of d.project.instances) {
      let plan = planByInstance.get(instance.oid);

      // The environment carries another instance's canonical name, so this link is the stale side
      // of the disagreement. Dropping it lets the regular path provision this instance its own
      // environment instead of leaving it pointing at a row that belongs to a sibling.
      if (!plan && instance.subspaceEnvironmentId) {
        if (d.foreignEnvironmentIds.has(instance.subspaceEnvironmentId)) {
          clearedForeignLink.add(instance.oid);
          d.report.warnings.push(
            `Instance ${instance.id} dropped its link to ${instance.subspaceEnvironmentId}, which names another instance`
          );
        } else {
          // Nothing names this environment, so it may well hold this instance's data. Clearing the
          // link would orphan it, so the link stays and the instance is held back from the handoff.
          keptExistingLink.add(instance.oid);
          d.report.warnings.push(
            `Instance ${instance.id} keeps its existing environment link ${instance.subspaceEnvironmentId}, no candidate resolved to it`
          );
        }
      }

      await metorialDb.instance.update({
        where: { oid: instance.oid },
        data: {
          internalTenantIdentifier: d.tenantIdentifier,
          subspaceTenantId: d.survivorTenant.id,
          ...(plan
            ? {
                internalEnvironmentIdentifier: plan.identifier,
                subspaceEnvironmentId: plan.survivor.id
              }
            : {}),
          ...(clearedForeignLink.has(instance.oid)
            ? { internalEnvironmentIdentifier: null, subspaceEnvironmentId: null }
            : {}),
          lastSubspaceSyncAt: new Date()
        }
      });
    }

    let organization = (
      await metorialDb.project.findUnique({
        where: { oid: d.project.oid },
        select: { organization: { select: { id: true, subspaceTenantIds: true } } }
      })
    )?.organization;

    if (!organization) return keptExistingLink;

    let retired = new Set(d.report.retiredTenantIds);
    let subspaceTenantIds = [
      ...new Set(
        [...organization.subspaceTenantIds, d.survivorTenant.id].filter(id => !retired.has(id))
      )
    ];

    await metorialDb.organization.update({
      where: { id: organization.id },
      data: { subspaceTenantIds }
    });

    return keptExistingLink;
  }

  private async repairKeptEnvironmentMirrors(d: {
    project: ScopeProject;
    keptExistingLink: Set<bigint>;
    report: LegacyScopeReport;
  }) {
    for (let instance of d.project.instances) {
      if (!d.keptExistingLink.has(instance.oid) || !instance.subspaceEnvironmentId) continue;

      let environment = await subspaceDb.environment.findUnique({
        where: { id: instance.subspaceEnvironmentId },
        select: { oid: true, identifier: true, tenantOid: true, instanceOid: true }
      });
      if (!environment) continue;

      let namedInstanceOid = parseCanonicalInstanceOid(environment.identifier);
      if (namedInstanceOid !== null && namedInstanceOid !== instance.oid) {
        d.report.warnings.push(
          `Environment ${instance.subspaceEnvironmentId} names instance ${namedInstanceOid}, leaving its mirror alone`
        );
        continue;
      }

      let claimants = await metorialDb.instance.count({
        where: { subspaceEnvironmentId: instance.subspaceEnvironmentId }
      });
      if (claimants !== 1) {
        d.report.warnings.push(
          `Environment ${instance.subspaceEnvironmentId} is claimed by ${claimants} instances, leaving its mirror alone`
        );
        continue;
      }

      let mirroredInstanceOid = await ensureInstanceMirror({
        instanceOid: instance.oid,
        environmentOid: environment.oid,
        tenantOid: environment.tenantOid
      });
      if (mirroredInstanceOid === null || environment.instanceOid === mirroredInstanceOid) {
        continue;
      }

      await subspaceDb.environment.updateMany({
        where: { id: instance.subspaceEnvironmentId },
        data: { instanceOid: mirroredInstanceOid }
      });

      d.report.warnings.push(
        `Repointed environment ${instance.subspaceEnvironmentId} at instance ${instance.id}, the next run can promote it`
      );
    }
  }

  private async handOffToRegularReconciliation(d: {
    projectOid: bigint;
    skipInstanceOids?: Set<bigint>;
  }) {
    let project = await metorialDb.project.findUnique({
      where: { oid: d.projectOid },
      include: { instances: true }
    });
    if (!project) return;

    let instances = project.instances.filter(
      instance => !d.skipInstanceOids?.has(instance.oid)
    );

    if (instances.length === 0) {
      await metorialResourceService.syncProject(project);
    } else {
      for (let instance of instances) {
        await metorialResourceService.syncInstance(instance);
      }
    }

    if (d.skipInstanceOids?.size) return;

    await reconcileResourceLinksService.reconcileProjectLinks({ projectOid: d.projectOid });
  }
}

export let reconcileLegacyScopeService = Service.create(
  'reconcileLegacyScopeService',
  () => new ReconcileLegacyScopeServiceImpl()
).build();
