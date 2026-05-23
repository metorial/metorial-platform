import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Slate, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { buildSlateFilterClause, type SubRegistryWithFilters } from '../lib/subRegistryFilter';

let include = {
  scope: true,
  tenant: true,
  unbuiltCurrentVersion: true,
  builtOrUnbuiltCurrentVersion: true,
  createdByUser: { include: { scope: true } },
  categories: { include: { category: true } }
};

class slateServiceImpl {
  async getSlateById(d: {
    id: string;
    tenant?: Tenant;
    subRegistry?: SubRegistryWithFilters | null;
  }) {
    let filterClause = buildSlateFilterClause(d.subRegistry, d.tenant?.oid);

    let normalizedId = d.id.startsWith('@') ? d.id.slice(1) : d.id;

    let slate = await db.slate.findFirst({
      where: {
        status: 'active',

        AND: [
          {
            OR: [
              { id: normalizedId },
              { fullIdentifier: normalizedId },
              { id: `@${normalizedId}` },
              { fullIdentifier: `@${normalizedId}` }
            ]
          },
          filterClause
        ]
      },
      include
    });
    if (!slate) throw new ServiceError(notFoundError('slate'));
    return slate;
  }

  async updateSlate(d: {
    slate: Slate;
    input: {
      name?: string;
      description?: string;
      logoUrl?: string | null;
      skills?: string[];
    };
  }) {
    return await db.slate.update({
      where: { oid: d.slate.oid },
      data: {
        skills: d.input.skills,
        name: d.input.name,
        description: d.input.description,
        logoUrl: d.input.logoUrl ?? undefined
      },
      include
    });
  }

  async listSlates(d: {
    tenant?: Tenant;
    subRegistry?: SubRegistryWithFilters | null;
    scopeIds?: string[];
    userIds?: string[];
    workspaceIds?: string[];
    search?: string;
  }) {
    let search = d.search?.trim();
    let scopes = d.scopeIds
      ? await db.scope.findMany({
          where: {
            status: 'active',
            OR: [{ id: { in: d.scopeIds } }, { identifier: { in: d.scopeIds } }]
          }
        })
      : undefined;
    let users = d.userIds
      ? await db.user.findMany({
          where: {
            status: 'active',
            OR: [{ id: { in: d.userIds } }, { identifier: { in: d.userIds } }]
          }
        })
      : undefined;
    let workspaces = d.workspaceIds
      ? await db.workspace.findMany({
          where: {
            status: 'active',
            OR: [{ id: { in: d.workspaceIds } }, { identifier: { in: d.workspaceIds } }]
          }
        })
      : undefined;

    let allScopeOids = [
      ...(scopes?.map(s => s.oid) ?? []),
      ...(users?.map(u => u.scopeOid) ?? []),
      ...(workspaces?.map(w => w.scopeOid) ?? [])
    ];

    let anyScopeOids = allScopeOids.length > 0 ? allScopeOids : undefined;

    let filterClause = buildSlateFilterClause(d.subRegistry, d.tenant?.oid);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slate.findMany({
            ...opts,
            where: {
              status: 'active',

              scopeOid: anyScopeOids ? { in: anyScopeOids } : undefined,
              ...(search
                ? {
                    name: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  }
                : {}),

              AND: [filterClause]
            },
            include
          })
      )
    );
  }
}

export let slateService = Service.create('slateService', () => new slateServiceImpl()).build();
