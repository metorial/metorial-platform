import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import { Context } from '@metorial/context';
import {
  db,
  ID,
  Organization,
  OrganizationActor,
  TeamRole,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { instanceScopes, scopeDefinitions } from '@metorial/module-access';

let getTeamRoleSlug = createSlugGenerator(
  async (slug, d: { organization: Organization }) =>
    !(await db.teamRole.findFirst({ where: { slug, organizationOid: d.organization.oid } }))
);

let scopeDependencyMap = new Map(
  scopeDefinitions.map(scope => [scope.identifier, scope.dependencies])
);

let getMissingScopeDependencies = (permissionSet: string[]) => {
  let permissionSetLookup = new Set(permissionSet);
  let missingDependencies = new Set<string>();

  permissionSet.forEach(permission => {
    let dependencies = scopeDependencyMap.get(permission as any) || [];
    dependencies.forEach(dependency => {
      if (!permissionSetLookup.has(dependency)) {
        missingDependencies.add(dependency);
      }
    });
  });

  return [...missingDependencies];
};

class teamRoleServiceImpl {
  async createTeamRole(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name: string;
      description?: string;
      permissions?: string[];
    };
  }) {
    let permissionSet = [...new Set(d.input.permissions || [])];
    if (permissionSet.some(p => !instanceScopes.includes(p as any))) {
      throw new ServiceError(
        badRequestError({
          message: 'One or more permissions are invalid'
        })
      );
    }
    let missingDependencies = getMissingScopeDependencies(permissionSet);
    if (missingDependencies.length > 0) {
      throw new ServiceError(
        badRequestError({
          message: `Missing permission dependencies: ${missingDependencies.join(', ')}`
        })
      );
    }

    return withTransaction(async db => {
      await Fabric.fire('organization.team.role.created:before', d);

      let teamRole = await db.teamRole.create({
        data: {
          id: await ID.generateId('teamRole'),
          slug: await getTeamRoleSlug(
            { input: d.input.name },
            { organization: d.organization }
          ),
          name: d.input.name,
          description: d.input.description,
          scopes: permissionSet,
          organizationOid: d.organization.oid
        },
        include: {
          organization: true
        }
      });

      await Fabric.fire('organization.team.role.created:after', {
        ...d,
        role: teamRole,
        performedBy: d.performedBy
      });

      return teamRole;
    });
  }

  async updateTeamRole(d: {
    teamRole: TeamRole;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name?: string;
      description?: string;
      permissions?: string[];
    };
  }) {
    let permissionSet = d.input.permissions ? [...new Set(d.input.permissions)] : undefined;
    if (permissionSet && permissionSet.some(p => !instanceScopes.includes(p as any))) {
      throw new ServiceError(
        badRequestError({
          message: 'One or more permissions are invalid'
        })
      );
    }
    if (permissionSet) {
      let missingDependencies = getMissingScopeDependencies(permissionSet);
      if (missingDependencies.length > 0) {
        throw new ServiceError(
          badRequestError({
            message: `Missing permission dependencies: ${missingDependencies.join(', ')}`
          })
        );
      }
    }

    return withTransaction(async db => {
      await Fabric.fire('organization.team.role.updated:before', {
        ...d,
        role: d.teamRole
      });

      let teamRole = await db.teamRole.update({
        where: { oid: d.teamRole.oid },
        data: {
          name: d.input.name,
          description: d.input.description,
          scopes: permissionSet
        },
        include: {
          organization: true
        }
      });

      await Fabric.fire('organization.team.role.updated:after', {
        ...d,
        role: teamRole,
        performedBy: d.performedBy
      });

      return teamRole;
    });
  }

  async getTeamRoleById(d: { organization: Organization; teamRoleId: string }) {
    let teamRole = await db.teamRole.findFirst({
      where: {
        OR: [{ id: d.teamRoleId }, { slug: d.teamRoleId }],
        organizationOid: d.organization.oid
      },
      include: {
        organization: true
      }
    });
    if (!teamRole) throw new ServiceError(notFoundError('teamRole', d.teamRoleId));

    return teamRole;
  }

  async getManyTeamRolesByIds(d: { organization: Organization; teamRoleIds: string[] }) {
    let teamRoles = await db.teamRole.findMany({
      where: {
        OR: [{ id: { in: d.teamRoleIds } }, { slug: { in: d.teamRoleIds } }],
        organizationOid: d.organization.oid
      },
      include: {
        organization: true
      }
    });

    let uniqueIds = [...new Set(d.teamRoleIds)];
    if (teamRoles.length !== uniqueIds.length) {
      let foundIds = new Set(teamRoles.map(tr => tr.id));
      let notFoundIds = d.teamRoleIds.filter(id => !foundIds.has(id));
      throw new ServiceError(notFoundError('teamRoles', notFoundIds.join(', ')));
    }

    return teamRoles;
  }

  async listTeamRoles(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.teamRole.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid
            },
            include: {
              organization: true
            }
          })
      )
    );
  }
}

export let teamRoleService = Service.create(
  'teamRoleService',
  () => new teamRoleServiceImpl()
).build();
