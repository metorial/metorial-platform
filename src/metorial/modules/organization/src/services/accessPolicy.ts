import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import type { AuditScope } from '@metorial/audit-scope';
import {
  AccessPolicy,
  AccessPolicyType,
  AccessRole,
  db,
  ID,
  Organization,
  Prisma,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { normalizePolicyDocument, PolicyDocument } from '../lib/accessControl';

let getAccessPolicySlug = createSlugGenerator(
  async (slug, d: { organization: Organization }) =>
    !(await db.accessPolicy.findFirst({
      where: { slug, organizationOid: d.organization.oid }
    }))
);

export let accessPolicyInclude = {
  organization: true,
  accessPolicyRoles: {
    include: {
      accessRole: {
        include: {
          organization: true
        }
      }
    }
  },
  accessPolicyProjects: {
    include: {
      project: true
    }
  },
  accessPolicyInstances: {
    include: {
      instance: {
        include: {
          project: true,
          organization: true
        }
      }
    }
  },
  accessPolicyVersions: {
    orderBy: {
      index: 'desc'
    }
  }
} as const;

export type AccessPolicyWithRelations = Prisma.AccessPolicyGetPayload<{
  include: typeof accessPolicyInclude;
}>;

let getTargetType = (target: string) => {
  if (target.startsWith('org_')) return 'organization';
  if (target.startsWith('prj_')) return 'project';
  if (target.startsWith('ins_')) return 'instance';

  throw new ServiceError(
    badRequestError({
      message: `Unsupported policy target: ${target}`
    })
  );
};

let resolvePolicyDocument = async (d: {
  organization: Organization;
  document: PolicyDocument;
}) => {
  return await withTransaction(
    async db => {
      let document = normalizePolicyDocument(d.document);

      let roleIds = [...new Set(document.access.flatMap(entry => entry.roles || []))];
      let targetIds = [...new Set(document.access.map(entry => entry.target))];

      let accessRoles = roleIds.length
        ? await db.accessRole.findMany({
            where: {
              organizationOid: d.organization.oid,
              OR: [{ id: { in: roleIds } }, { slug: { in: roleIds } }]
            }
          })
        : [];

      let roleLookup = new Map<string, AccessRole>();
      accessRoles.forEach(role => {
        roleLookup.set(role.id, role);
        roleLookup.set(role.slug, role);
      });

      let missingRoles = roleIds.filter(roleId => !roleLookup.has(roleId));
      if (missingRoles.length > 0) {
        throw new ServiceError(notFoundError('access_role', missingRoles.join(', ')));
      }

      let organizationTargets = targetIds.filter(
        target => getTargetType(target) == 'organization'
      );
      if (organizationTargets.some(target => target !== d.organization.id)) {
        throw new ServiceError(
          badRequestError({
            message: 'Policies may only reference the owning organization'
          })
        );
      }

      let projects = await db.project.findMany({
        where: {
          organizationOid: d.organization.oid,
          id: { in: targetIds.filter(target => getTargetType(target) == 'project') }
        }
      });
      let projectLookup = new Map(projects.map(project => [project.id, project]));

      let instances = await db.instance.findMany({
        where: {
          organizationOid: d.organization.oid,
          id: { in: targetIds.filter(target => getTargetType(target) == 'instance') }
        }
      });
      let instanceLookup = new Map(instances.map(instance => [instance.id, instance]));

      let missingTargets = targetIds.filter(target => {
        let type = getTargetType(target);
        if (type == 'organization') return target !== d.organization.id;
        if (type == 'project') return !projectLookup.has(target);
        return !instanceLookup.has(target);
      });

      if (missingTargets.length > 0) {
        throw new ServiceError(notFoundError('policy_target', missingTargets.join(', ')));
      }

      return {
        document,
        accessRoles,
        projects,
        instances
      };
    },
    { ifExists: false }
  );
};

let syncCurrentPolicyTargets = async (d: {
  accessPolicy: AccessPolicy;
  accessRoles: AccessRole[];
  projects: { oid: bigint }[];
  instances: { oid: bigint }[];
}) => {
  await withTransaction(async db => {
    await db.accessPolicyRole.deleteMany({
      where: {
        accessPolicyOid: d.accessPolicy.oid
      }
    });
    await db.accessPolicyProject.deleteMany({
      where: {
        accessPolicyOid: d.accessPolicy.oid
      }
    });
    await db.accessPolicyInstance.deleteMany({
      where: {
        accessPolicyOid: d.accessPolicy.oid
      }
    });

    await db.accessPolicyRole.createMany({
      data: d.accessRoles.map(accessRole => ({
        id: ID.generateIdSync('accessPolicyRole'),
        accessPolicyOid: d.accessPolicy.oid,
        accessRoleOid: accessRole.oid
      }))
    });

    await db.accessPolicyProject.createMany({
      data: d.projects.map(project => ({
        id: ID.generateIdSync('accessPolicyProject'),
        accessPolicyOid: d.accessPolicy.oid,
        projectOid: project.oid
      }))
    });

    await db.accessPolicyInstance.createMany({
      data: d.instances.map(instance => ({
        id: ID.generateIdSync('accessPolicyInstance'),
        accessPolicyOid: d.accessPolicy.oid,
        instanceOid: instance.oid
      }))
    });
  });
};

class AccessPolicyService {
  async createAccessPolicy(d: {
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name: string;
      description?: string;
      document: PolicyDocument;
      type?: AccessPolicyType;
      message?: string;
    };
  }) {
    let resolved = await resolvePolicyDocument({
      organization: d.organization,
      document: d.input.document
    });

    return await withTransaction(async db => {
      await Fabric.fire('organization.access_policy.created:before', d);

      let accessPolicy = await db.accessPolicy.create({
        data: {
          id: await ID.generateId('accessPolicy'),
          slug: await getAccessPolicySlug(
            { input: d.input.name },
            { organization: d.organization }
          ),
          type: d.input.type ?? 'custom',
          name: d.input.name,
          description: d.input.description,
          document: resolved.document,
          organizationOid: d.organization.oid,
          accessPolicyVersions: {
            create: {
              id: await ID.generateId('accessPolicyVersion'),
              index: 0,
              message: d.input.message,
              document: resolved.document
            }
          }
        },
        include: accessPolicyInclude
      });

      await syncCurrentPolicyTargets({
        accessPolicy,
        accessRoles: resolved.accessRoles,
        projects: resolved.projects,
        instances: resolved.instances
      });

      accessPolicy = await db.accessPolicy.findUniqueOrThrow({
        where: { oid: accessPolicy.oid },
        include: accessPolicyInclude
      });

      await Fabric.fire('organization.access_policy.created:after', {
        organization: d.organization,
        input: d.input,
        accessPolicy,
        auditScope: d.auditScope
      });

      return accessPolicy;
    });
  }

  async updateAccessPolicy(d: {
    accessPolicy: AccessPolicy;
    organization: Organization;
    auditScope: AuditScope;
    allowDefaultDocumentUpdate?: boolean;
    input: {
      name?: string;
      description?: string | null;
      document?: PolicyDocument;
      message?: string;
    };
  }) {
    if (d.accessPolicy.type == 'admin' && d.input.document && !d.allowDefaultDocumentUpdate) {
      throw new ServiceError(
        badRequestError({
          message: 'Default policies cannot change their policy document'
        })
      );
    }

    return await withTransaction(async db => {
      let resolved = d.input.document
        ? await resolvePolicyDocument({
            organization: d.organization,
            document: d.input.document
          })
        : null;

      await Fabric.fire('organization.access_policy.updated:before', d);

      let latestVersion = await db.accessPolicyVersion.findFirst({
        where: { accessPolicyOid: d.accessPolicy.oid },
        orderBy: { index: 'desc' }
      });

      let accessPolicy = await db.accessPolicy.update({
        where: { oid: d.accessPolicy.oid },
        data: {
          name: d.input.name,
          description: d.input.description,
          document: resolved?.document,
          hasBeenCustomized: !d.allowDefaultDocumentUpdate && d.auditScope.actor.type != 'system',
          accessPolicyVersions: resolved
            ? {
                create: {
                  id: await ID.generateId('accessPolicyVersion'),
                  index: (latestVersion?.index ?? -1) + 1,
                  message: d.input.message,
                  document: resolved.document
                }
              }
            : undefined
        },
        include: accessPolicyInclude
      });

      if (resolved) {
        await syncCurrentPolicyTargets({
          accessPolicy,
          accessRoles: resolved.accessRoles,
          projects: resolved.projects,
          instances: resolved.instances
        });

        accessPolicy = await db.accessPolicy.findUniqueOrThrow({
          where: { oid: accessPolicy.oid },
          include: accessPolicyInclude
        });
      }

      await Fabric.fire('organization.access_policy.updated:after', {
        organization: d.organization,
        input: d.input,
        accessPolicy,
        previousAccessPolicy: d.accessPolicy,
        auditScope: d.auditScope
      });

      return accessPolicy;
    });
  }

  async deleteAccessPolicy(d: {
    accessPolicy: AccessPolicyWithRelations;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    if (d.accessPolicy.type != 'custom') {
      throw new ServiceError(
        badRequestError({
          message: 'Default policies cannot be deleted'
        })
      );
    }

    return withTransaction(async db => {
      await Fabric.fire('organization.access_policy.deleted:before', d);
      await db.accessPolicy.delete({
        where: { oid: d.accessPolicy.oid }
      });
      await Fabric.fire('organization.access_policy.deleted:after', {
        organization: d.organization,
        accessPolicy: d.accessPolicy,
        auditScope: d.auditScope
      });

      return d.accessPolicy;
    });
  }

  async getAccessPolicyById(d: { organization: Organization; accessPolicyId: string }) {
    let accessPolicy = await db.accessPolicy.findFirst({
      where: {
        organizationOid: d.organization.oid,
        OR: [{ id: d.accessPolicyId }, { slug: d.accessPolicyId }]
      },
      include: accessPolicyInclude
    });

    if (!accessPolicy) {
      throw new ServiceError(notFoundError('access_policy', d.accessPolicyId));
    }

    return accessPolicy;
  }

  async getDefaultAccessPolicy(d: {
    organization: Organization;
    type: Extract<AccessPolicyType, 'everyone' | 'admin'>;
  }) {
    return withTransaction(
      async db => {
        return db.accessPolicy.findFirst({
          where: {
            organizationOid: d.organization.oid,
            type: d.type
          },
          include: accessPolicyInclude
        });
      },
      { ifExists: false }
    );
  }

  async listAccessPolicies(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.accessPolicy.findMany({
          ...opts,
          where: {
            organizationOid: d.organization.oid
          },
          include: accessPolicyInclude
        })
      )
    );
  }

  async listAccessPolicyVersions(d: {
    organization: Organization;
    accessPolicy: AccessPolicyWithRelations;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.accessPolicyVersion.findMany({
          ...opts,
          where: {
            accessPolicyOid: d.accessPolicy.oid
          },
          orderBy: {
            index: 'desc'
          },
          include: {
            accessPolicy: {
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

export let accessPolicyService = Service.create(
  'accessPolicyService',
  () => new AccessPolicyService()
).build();
