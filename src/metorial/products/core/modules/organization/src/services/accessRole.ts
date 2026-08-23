import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import type { AuditScope } from '@metorial/audit-scope';
import {
  AccessRole,
  AccessRoleVersion,
  db,
  ID,
  Organization,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { normalizeScopes } from '../lib/accessControl';

let getAccessRoleSlug = createSlugGenerator(
  async (slug, d: { organization: Organization }) =>
    !(await db.accessRole.findFirst({ where: { slug, organizationOid: d.organization.oid } }))
);

export let accessRoleInclude = {
  organization: true,
  accessRoleVersions: {
    orderBy: {
      index: 'desc'
    }
  }
} as const;

export type AccessRoleWithRelations = AccessRole & {
  organization: Organization;
  accessRoleVersions: AccessRoleVersion[];
};

class AccessRoleService {
  async createAccessRole(d: {
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name: string;
      description?: string;
      scopes?: string[];
      isAdmin?: boolean;
      message?: string;
    };
  }) {
    let scopeSet = normalizeScopes(d.input.scopes);

    return await withTransaction(async db => {
      await Fabric.fire('organization.access_role.created:before', d);

      let accessRole = await db.accessRole.create({
        data: {
          id: await ID.generateId('accessRole'),
          slug: await getAccessRoleSlug(
            { input: d.input.name },
            { organization: d.organization }
          ),
          isAdmin: d.input.isAdmin ?? false,
          name: d.input.name,
          description: d.input.description,
          scopes: scopeSet,
          organizationOid: d.organization.oid,
          accessRoleVersions: {
            create: {
              id: await ID.generateId('accessRoleVersion'),
              index: 0,
              scopes: scopeSet,
              scopesAdded: scopeSet,
              scopesRemoved: [],
              message: d.input.message
            }
          }
        },
        include: accessRoleInclude
      });

      await Fabric.fire('organization.access_role.created:after', {
        organization: d.organization,
        input: d.input,
        accessRole,
        auditScope: d.auditScope
      });

      return accessRole;
    });
  }

  async updateAccessRole(d: {
    accessRole: AccessRole;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name?: string;
      description?: string | null;
      scopes?: string[];
      message?: string;
    };
  }) {
    let scopeSet = d.input.scopes ? normalizeScopes(d.input.scopes) : undefined;

    return await withTransaction(async db => {
      await Fabric.fire('organization.access_role.updated:before', d);

      let latestVersion = await db.accessRoleVersion.findFirst({
        where: { accessRoleOid: d.accessRole.oid },
        orderBy: { index: 'desc' }
      });

      let nextScopes = scopeSet ?? d.accessRole.scopes;
      let previousScopes = d.accessRole.scopes;
      let scopesAdded = nextScopes.filter(scope => !previousScopes.includes(scope));
      let scopesRemoved = previousScopes.filter(scope => !nextScopes.includes(scope));

      let accessRole = await db.accessRole.update({
        where: { oid: d.accessRole.oid },
        data: {
          name: d.input.name,
          description: d.input.description,
          scopes: scopeSet,
          accessRoleVersions: scopeSet
            ? {
                create: {
                  id: await ID.generateId('accessRoleVersion'),
                  index: (latestVersion?.index ?? -1) + 1,
                  scopes: nextScopes,
                  scopesAdded,
                  scopesRemoved,
                  message: d.input.message
                }
              }
            : undefined
        },
        include: accessRoleInclude
      });

      await Fabric.fire('organization.access_role.updated:after', {
        organization: d.organization,
        input: d.input,
        accessRole,
        previousAccessRole: d.accessRole,
        auditScope: d.auditScope
      });

      return accessRole;
    });
  }

  async deleteAccessRole(d: {
    accessRole: AccessRoleWithRelations;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    if (d.accessRole.isAdmin) {
      throw new ServiceError(
        badRequestError({
          message: 'Admin access roles cannot be deleted'
        })
      );
    }

    let assignments = await db.accessPolicyRole.count({
      where: {
        accessRoleOid: d.accessRole.oid
      }
    });

    if (assignments > 0) {
      throw new ServiceError(
        badRequestError({
          message: 'Access role is still referenced by one or more policies'
        })
      );
    }

    return await withTransaction(async db => {
      await Fabric.fire('organization.access_role.deleted:before', d);
      await db.accessRole.delete({ where: { oid: d.accessRole.oid } });
      await Fabric.fire('organization.access_role.deleted:after', {
        organization: d.organization,
        accessRole: d.accessRole,
        auditScope: d.auditScope
      });

      return d.accessRole;
    });
  }

  async getAccessRoleById(d: { organization: Organization; accessRoleId: string }) {
    let accessRole = await db.accessRole.findFirst({
      where: {
        organizationOid: d.organization.oid,
        OR: [{ id: d.accessRoleId }, { slug: d.accessRoleId }]
      },
      include: accessRoleInclude
    });

    if (!accessRole) {
      throw new ServiceError(notFoundError('access_role', d.accessRoleId));
    }

    return accessRole;
  }

  async getManyAccessRolesByIds(d: { organization: Organization; accessRoleIds: string[] }) {
    let accessRoles = await db.accessRole.findMany({
      where: {
        organizationOid: d.organization.oid,
        OR: [{ id: { in: d.accessRoleIds } }, { slug: { in: d.accessRoleIds } }]
      },
      include: accessRoleInclude
    });

    let found = new Set<string>();
    for (let accessRole of accessRoles) {
      found.add(accessRole.id);
      found.add(accessRole.slug);
    }

    let missing = [...new Set(d.accessRoleIds)].filter(id => !found.has(id));
    if (missing.length > 0) {
      throw new ServiceError(notFoundError('access_role', missing.join(', ')));
    }

    return accessRoles;
  }

  async listAccessRoles(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.accessRole.findMany({
          ...opts,
          where: {
            organizationOid: d.organization.oid
          },
          include: accessRoleInclude
        })
      )
    );
  }

  async listAccessRoleVersions(d: {
    organization: Organization;
    accessRole: AccessRoleWithRelations;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.accessRoleVersion.findMany({
          ...opts,
          where: {
            accessRoleOid: d.accessRole.oid
          },
          orderBy: {
            index: 'desc'
          },
          include: {
            accessRole: {
              include: {
                organization: true
              }
            }
          }
        })
      )
    );
  }
}

export let accessRoleService = Service.create(
  'accessRoleService',
  () => new AccessRoleService()
).build();
