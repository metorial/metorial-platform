import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Scope, Tenant, Workspace } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

let include = {
  scope: true,
  tenant: true
};

class workspaceServiceImpl {
  async createWorkspace(d: {
    input: {
      name: string;
      identifier: string;
      description?: string;
    };
    tenant: Tenant;
  }) {
    return db.$transaction(async db => {
      let existingScope = await db.scope.findFirst({
        where: {
          identifier: d.input.identifier
        }
      });
      if (existingScope) {
        throw new ServiceError(
          conflictError({
            message: `Workspace with identifier ${d.input.identifier} already exists`
          })
        );
      }

      let scope = await db.scope.create({
        data: {
          ...getId('scope'),
          type: 'workspace' as const,
          status: 'active',

          identifier: d.input.identifier,
          name: d.input.name,
          description: d.input.description,

          tenantOid: d.tenant.oid,

          links: []
        }
      });

      return await db.workspace.create({
        data: {
          ...getId('workspace'),
          status: 'active',

          identifier: d.input.identifier,
          name: d.input.name,

          tenantOid: d.tenant.oid,
          scopeOid: scope.oid
        },
        include
      });
    });
  }

  async getWorkspaceById(d: { id: string; tenant?: Tenant }) {
    let workspace = await db.workspace.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }],
        tenantOid: d.tenant?.oid,
        status: 'active'
      },
      include
    });
    if (!workspace) throw new ServiceError(notFoundError('workspace'));
    return workspace;
  }

  async listWorkspaces(d: { tenant?: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.workspace.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant?.oid,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async updateWorkspace(d: {
    workspace: Workspace & { scope: Scope };
    input: {
      name?: string;
      description?: string;
      links?: { url: string; label: string }[];
    };
  }) {
    return await db.$transaction(async db => {
      await db.scope.update({
        where: { oid: d.workspace.scope.oid },
        data: {
          name: d.input.name,
          description: d.input.description,
          links: d.input.links
        }
      });

      return await db.workspace.update({
        where: { oid: d.workspace.oid },
        data: { name: d.input.name },
        include
      });
    });
  }
}

export let workspaceService = Service.create(
  'workspaceService',
  () => new workspaceServiceImpl()
).build();
