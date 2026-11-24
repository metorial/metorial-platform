import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  db,
  ID,
  isUniqueConstraintError,
  withTransaction,
  type Instance,
  type Organization,
  type Prisma,
  type Project
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { assertAgentTrackingEnabled } from '@metorial/module-agent-tracking-sync';
import {
  agentTrackingViewEntity,
  assertViewParams,
  maxViewsPerPage,
  parseViewName,
  type AgentTrackingViewPage,
  type TeamViewKind,
  type TeamViewParams
} from '../lib/views';

let agentTrackingViewInclude = {
  instance: { include: { organization: true, project: true } },
  creatorActor: {
    include: { organization: true, member: true, teams: { include: { team: true } } }
  }
} as const;

export type AgentTrackingViewRecord = Prisma.AgentTrackingViewGetPayload<{
  include: typeof agentTrackingViewInclude;
}>;

let nameTaken = (name: string) =>
  new ServiceError(
    conflictError({
      message: `A saved view named "${name}" already exists on this page.`,
      hint: 'Choose another name. Names are compared without regard to case.'
    })
  );

let viewNotFound = (viewId: string) =>
  new ServiceError(notFoundError(agentTrackingViewEntity, viewId));

let isRecordMissing = (error: unknown) => (error as { code?: string } | null)?.code == 'P2025';

class AgentTrackingViewServiceImpl {
  async createView(d: {
    organization: Organization;
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    input: {
      page: AgentTrackingViewPage;
      name: string;
      kind: TeamViewKind;
      params: TeamViewParams;
    };
  }) {
    await this.assertEnabled(d);

    let { page, kind, params } = d.input;
    let { name, nameKey } = parseViewName(d.input.name);
    assertViewParams(kind, params);

    await Fabric.fire('agent_tracking.view.created:before', {
      organization: d.organization,
      instance: d.instance,
      input: { page, name, kind, params },
      auditScope: d.auditScope
    });

    try {
      return await withTransaction(async db => {
        let liveViews = await db.agentTrackingView.count({
          where: { instanceOid: d.instance.oid, page, status: 'active' }
        });
        if (liveViews >= maxViewsPerPage) {
          throw new ServiceError(
            badRequestError({
              code: 'view_limit_exceeded',
              message: `An instance can have at most ${maxViewsPerPage} saved views per page.`,
              hint: 'Delete a saved view before creating another.'
            })
          );
        }

        let view = await db.agentTrackingView.create({
          data: {
            id: await ID.generateId('agentTrackingView'),
            page,
            kind,
            name,
            nameKey,
            params,
            instanceOid: d.instance.oid,
            creatorActorOid: d.auditScope.organizationActorOid ?? null
          },
          include: agentTrackingViewInclude
        });

        await Fabric.fire('agent_tracking.view.created:after', {
          view,
          auditScope: d.auditScope
        });

        return view;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw nameTaken(name);
      throw error;
    }
  }

  async getViewById(d: { instance: Instance; viewId: string }) {
    let view = await db.agentTrackingView.findFirst({
      where: { id: d.viewId, instanceOid: d.instance.oid, status: 'active' },
      include: agentTrackingViewInclude
    });
    if (!view) throw viewNotFound(d.viewId);

    return view;
  }

  async listViews(d: { instance: Instance; pages?: AgentTrackingViewPage[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.agentTrackingView.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,
              status: 'active',
              ...(d.pages ? { page: { in: d.pages } } : {})
            },
            include: agentTrackingViewInclude
          })
      )
    );
  }

  async updateView(d: {
    view: AgentTrackingViewRecord;
    auditScope: AuditScope;
    input: { name?: string; kind?: TeamViewKind; params?: TeamViewParams };
  }) {
    await this.assertEnabled({
      organization: d.view.instance.organization,
      project: d.view.instance.project
    });

    let renamed = d.input.name === undefined ? null : parseViewName(d.input.name);
    assertViewParams(
      d.input.kind ?? (d.view.kind as TeamViewKind),
      d.input.params ?? d.view.params
    );

    await Fabric.fire('agent_tracking.view.updated:before', {
      view: d.view,
      input: { name: renamed?.name, kind: d.input.kind, params: d.input.params },
      auditScope: d.auditScope
    });

    try {
      return await withTransaction(async db => {
        let view = await db.agentTrackingView.update({
          where: { oid: d.view.oid, status: 'active' },
          data: { ...renamed, kind: d.input.kind, params: d.input.params },
          include: agentTrackingViewInclude
        });

        await Fabric.fire('agent_tracking.view.updated:after', {
          view,
          previousView: d.view,
          auditScope: d.auditScope
        });

        return view;
      });
    } catch (error) {
      if (renamed && isUniqueConstraintError(error)) throw nameTaken(renamed.name);
      if (isRecordMissing(error)) throw viewNotFound(d.view.id);
      throw error;
    }
  }

  async deleteView(d: { view: AgentTrackingViewRecord; auditScope: AuditScope }) {
    await this.assertEnabled({
      organization: d.view.instance.organization,
      project: d.view.instance.project
    });

    await Fabric.fire('agent_tracking.view.deleted:before', {
      view: d.view,
      auditScope: d.auditScope
    });

    try {
      return await withTransaction(async db => {
        let view = await db.agentTrackingView.update({
          where: { oid: d.view.oid, status: 'active' },
          data: { status: 'deleted', deletedAt: new Date(), nameKey: null },
          include: agentTrackingViewInclude
        });

        await Fabric.fire('agent_tracking.view.deleted:after', {
          view,
          previousView: d.view,
          auditScope: d.auditScope
        });

        return view;
      });
    } catch (error) {
      if (isRecordMissing(error)) throw viewNotFound(d.view.id);
      throw error;
    }
  }

  private async assertEnabled(d: { organization: Organization; project?: Project }) {
    await assertAgentTrackingEnabled({
      organization: d.organization,
      project: d.project,
      entity: agentTrackingViewEntity
    });
  }
}

export let agentTrackingViewService = Service.create(
  'agentTrackingViewService',
  () => new AgentTrackingViewServiceImpl()
).build();
