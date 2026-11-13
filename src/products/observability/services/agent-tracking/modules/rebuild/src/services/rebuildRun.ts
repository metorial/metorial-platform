import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Organization, RebuildRunStatus } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { rebuildManyQueue } from '../queues/rebuild';
import {
  activeRebuildStatuses,
  createRebuildRun,
  rebuildRunInclude,
  type RebuildRunWithRelations
} from '../lib/runs';
import {
  manualRebuildReason,
  normalizeLayers,
  type RebuildLayer
} from '@mtsrc/agent-tracking-layers';

class RebuildRunServiceImpl {
  async startRebuildRun(d: {
    organization: Organization;
    input: {
      scope?: { projectId?: string; instanceId?: string };
      range: { from: Date; to: Date };
      layers: RebuildLayer[];
      reason?: string;
    };
  }) {
    let layers = normalizeLayers(d.input.layers);
    if (!layers.length) {
      throw new ServiceError(badRequestError({ message: 'Pass at least one layer.' }));
    }

    if (d.input.range.from >= d.input.range.to) {
      throw new ServiceError(
        badRequestError({ message: 'The range must start before it ends.' })
      );
    }

    let scope = await this.resolveScope({
      organization: d.organization,
      scope: d.input.scope
    });

    let run = await createRebuildRun({
      organization: d.organization,
      ...scope,
      range: d.input.range,
      layers,
      reason: d.input.reason?.trim() || manualRebuildReason
    });

    await rebuildManyQueue.add({ rebuildRunId: run.id });

    return run;
  }

  async getRebuildRunById(d: { organization: Organization; rebuildRunId: string }) {
    let run = await db.rebuildRun.findFirst({
      where: { id: d.rebuildRunId, organizationOid: d.organization.oid },
      include: rebuildRunInclude
    });
    if (!run) throw new ServiceError(notFoundError('rebuild_run', d.rebuildRunId));

    return run;
  }

  async listRebuildRuns(d: { organization: Organization; statuses?: RebuildRunStatus[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.rebuildRun.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: d.statuses ? { in: d.statuses } : undefined
            },
            include: rebuildRunInclude
          })
      )
    );
  }

  async cancelRebuildRun(d: { rebuildRun: RebuildRunWithRelations }) {
    if (!activeRebuildStatuses.includes(d.rebuildRun.status)) return d.rebuildRun;

    await db.rebuildRun.updateMany({
      where: { oid: d.rebuildRun.oid, status: { in: activeRebuildStatuses } },
      data: { status: 'cancelled', completedAt: new Date() }
    });

    return await db.rebuildRun.findUniqueOrThrow({
      where: { oid: d.rebuildRun.oid },
      include: rebuildRunInclude
    });
  }

  private async resolveScope(d: {
    organization: Organization;
    scope?: { projectId?: string; instanceId?: string };
  }) {
    let project = d.scope?.projectId
      ? await db.project.findFirst({
          where: {
            OR: [{ id: d.scope.projectId }, { ref: d.scope.projectId }],
            organizationOid: d.organization.oid
          }
        })
      : null;
    if (d.scope?.projectId && !project) {
      throw new ServiceError(notFoundError('project', d.scope.projectId));
    }

    let instance = d.scope?.instanceId
      ? await db.instance.findFirst({
          where: {
            OR: [{ id: d.scope.instanceId }, { ref: d.scope.instanceId }],
            organizationOid: d.organization.oid
          }
        })
      : null;
    if (d.scope?.instanceId && !instance) {
      throw new ServiceError(notFoundError('instance', d.scope.instanceId));
    }

    if (project && instance && instance.projectOid != project.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'The scope instance does not belong to the scope project.'
        })
      );
    }

    return { project, instance };
  }
}

export let rebuildRunService = Service.create(
  'rebuildRunService',
  () => new RebuildRunServiceImpl()
).build();
