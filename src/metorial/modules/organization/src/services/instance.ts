import {
  conflictError,
  forbiddenError,
  notFoundError,
  notImplementedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAwaitedAfterTransactionHook,
  db,
  ID,
  Instance,
  InstanceType,
  Organization,
  OrganizationActor,
  OrganizationMember,
  Project,
  ResourceGroup,
  ResourceTenant,
  Sandbox,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCode } from '@metorial/id';
import { metorialResourceService } from '@metorial-subspace/module-tenant';
import { differenceInMinutes } from 'date-fns';

let getInstanceSlug = createSlugGenerator(async slug => {
  let instance = await db.instance.findFirst({
    where: {
      OR: [{ slug }, { oldSlug: slug }, { previousSlugs: { has: slug } }]
    }
  });
  if (instance) return false;

  let cellInstance = await db.cellInstance.findFirst({
    where: { slug }
  });
  if (cellInstance) return false;

  return true;
});

let getNextPreviousSlugs = (d: {
  previousSlugs: string[];
  currentSlug: string;
  nextSlug: string;
}) => {
  return Array.from(
    new Set([...d.previousSlugs.filter(slug => slug !== d.nextSlug), d.currentSlug])
  );
};

type InstanceWithRelations = Instance & {
  organization: Organization;
  project: Project;
};

type SandboxWithRelations = Sandbox & {
  creatorActor: OrganizationActor & { organization: Organization };
  instance: InstanceWithRelations;
};

class InstanceService {
  private async ensureInstanceActive(instance: Instance) {
    if (instance.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted instance'
        })
      );
    }
  }

  private async ensureSandboxActive(sandbox: Sandbox) {
    if (sandbox.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted sandbox'
        })
      );
    }
  }

  private async reclaimInstanceSlugOrThrow(d: {
    slug: string;
    instance?: Instance;
    canOverrideSlug?: boolean;
  }) {
    await withTransaction(
      async db => {
        let currentSlugInstance = await db.instance.findFirst({
          where: {
            slug: d.slug,
            id: d.instance ? { not: d.instance.id } : undefined
          }
        });

        if (currentSlugInstance) {
          if (!d.canOverrideSlug) {
            throw new ServiceError(
              conflictError({
                message: 'An instance with this slug already exists'
              })
            );
          }

          await db.instance.update({
            where: { oid: currentSlugInstance.oid },
            data: {
              slug: `${currentSlugInstance.slug}-${generateCode(3)}`
            }
          });
        }

        let previousSlugInstances = await db.instance.findMany({
          where: {
            previousSlugs: { has: d.slug },
            id: d.instance ? { not: d.instance.id } : undefined
          },
          select: {
            oid: true,
            previousSlugs: true
          }
        });

        for (let instance of previousSlugInstances) {
          await db.instance.update({
            where: { oid: instance.oid },
            data: {
              previousSlugs: instance.previousSlugs.filter(slug => slug !== d.slug)
            }
          });
        }
      },
      { ifExists: true }
    );
  }

  private async ensureCanCreateProductionInstance(d: { project: Project }) {
    await withTransaction(
      async db => {
        let existingProductionInstance = await db.instance.findFirst({
          where: {
            projectOid: d.project.oid,
            type: 'production',
            status: 'active'
          },
          select: { id: true }
        });

        if (existingProductionInstance) {
          throw new ServiceError(
            conflictError({
              message: 'A project can only have one production instance'
            })
          );
        }
      },
      { ifExists: true }
    );
  }

  private async syncInstanceCompanions(d: { instance: Instance; auditScope: AuditScope }) {
    let creatorActorOid = d.auditScope.organizationActorOid;
    if (creatorActorOid === undefined) {
      throw new Error(
        'Creating instance companions requires an audit scope bound to an organization actor'
      );
    }

    await withTransaction(
      async db => {
        let environment = await db.environment.findFirst({
          where: {
            instanceOid: d.instance.oid
          }
        });

        if (environment) {
          await db.environment.update({
            where: { oid: environment.oid },
            data: {
              name: d.instance.name,
              type: d.instance.type,
              status: 'active',
              deletedAt: null
            }
          });
        } else {
          await db.environment.create({
            data: {
              id: await ID.generateId('environment'),
              name: d.instance.name,
              type: d.instance.type,
              status: 'active',
              instanceOid: d.instance.oid,
              creatorActorOid
            }
          });
        }

        let sandbox = await db.sandbox.findFirst({
          where: {
            instanceOid: d.instance.oid
          }
        });

        if (d.instance.type === 'development') {
          if (sandbox) {
            await db.sandbox.update({
              where: { oid: sandbox.oid },
              data: {
                name: d.instance.name,
                status: 'active',
                deletedAt: null
              }
            });
          } else {
            await db.sandbox.create({
              data: {
                id: await ID.generateId('sandbox'),
                name: d.instance.name,
                status: 'active',
                instanceOid: d.instance.oid,
                creatorActorOid
              }
            });
          }
        } else if (sandbox && sandbox.status !== 'deleted') {
          await db.sandbox.update({
            where: { oid: sandbox.oid },
            data: {
              status: 'deleted',
              deletedAt: new Date()
            }
          });
        }
      },
      { ifExists: true }
    );
  }

  async generateInstanceSlug(d: {
    project: Project;
    input: {
      name: string;
      type: InstanceType;
    };
  }) {
    return await getInstanceSlug({
      input:
        d.input.type === 'development'
          ? `${d.project.name}-${d.input.name}-${generateCode(5)}`
          : `${d.project.name}`
    });
  }

  private async getSandboxOrThrow(d: {
    organization: Organization;
    sandboxId: string;
  }): Promise<SandboxWithRelations> {
    let sandbox = await db.sandbox.findFirst({
      where: {
        OR: [
          { id: d.sandboxId },
          {
            instance: {
              OR: [
                { id: d.sandboxId },
                { slug: d.sandboxId },
                { previousSlugs: { has: d.sandboxId } }
              ]
            }
          }
        ],
        instance: {
          organizationOid: d.organization.oid
        }
      },
      include: {
        creatorActor: {
          include: {
            organization: true
          }
        },
        instance: {
          include: {
            organization: true,
            project: true
          }
        }
      }
    });
    if (!sandbox) throw new ServiceError(notFoundError('sandbox', d.sandboxId));

    return sandbox;
  }

  async createInstance(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name: string;
      type: InstanceType;
    };
  }) {
    return await withTransaction(async db => {
      await Fabric.fire('organization.project.instance.created:before', d);

      if (d.input.type === 'production') {
        await this.ensureCanCreateProductionInstance({ project: d.project });
      }

      let slug = await this.generateInstanceSlug(d);

      let instance = await db.instance.create({
        data: {
          id: await ID.generateId('instance'),
          status: 'active',
          slug,
          name: d.input.name,
          type: d.input.type,
          hasBeenReconciled: true,
          hasBeenReconciled2: true,
          organizationOid: d.organization.oid,
          projectOid: d.project.oid
        },
        include: {
          organization: true,
          project: true,
          sandbox: true,
          resourceTenant: true,
          resourceGroup: true
        }
      });

      await this.syncInstanceCompanions({
        instance,
        auditScope: d.auditScope
      });

      await Fabric.fire('organization.project.instance.created:after', {
        organization: d.organization,
        project: d.project,
        input: d.input,
        instance,
        auditScope: d.auditScope
      });

      await addAwaitedAfterTransactionHook(() =>
        metorialResourceService.syncInstance(instance)
      );

      return instance;
    });
  }

  async updateInstance(d: {
    instance: Instance & { project: Project };
    organization: Organization;
    auditScope: AuditScope;
    canOverrideSlug?: boolean;
    input: {
      name?: string;
      slug?: string;
      type?: InstanceType;
    };
  }) {
    await this.ensureInstanceActive(d.instance);

    return await withTransaction(async db => {
      await Fabric.fire('organization.project.instance.updated:before', {
        ...d,
        project: d.instance.project
      });

      if (d.input.slug && d.input.slug !== d.instance.slug) {
        await this.reclaimInstanceSlugOrThrow({
          slug: d.input.slug,
          instance: d.instance
        });
      }

      let instance = await db.instance.update({
        where: { oid: d.instance.oid },
        data: {
          name: d.input.name,
          slug: d.input.slug,
          previousSlugs:
            d.input.slug && d.input.slug !== d.instance.slug
              ? getNextPreviousSlugs({
                  previousSlugs: d.instance.previousSlugs ?? [],
                  currentSlug: d.instance.slug,
                  nextSlug: d.input.slug
                })
              : undefined,
          type: d.input.type
        },
        include: {
          organization: true,
          project: true,
          sandbox: true,
          resourceTenant: true,
          resourceGroup: true
        }
      });

      await this.syncInstanceCompanions({
        instance,
        auditScope: d.auditScope
      });

      await Fabric.fire('organization.project.instance.updated:after', {
        organization: d.organization,
        input: d.input,
        instance,
        previousInstance: d.instance,
        project: d.instance.project,
        auditScope: d.auditScope
      });

      await addAwaitedAfterTransactionHook(() =>
        metorialResourceService.syncInstance(instance)
      );

      return instance;
    });
  }

  async createSandbox(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name: string;
    };
  }) {
    let instance = await this.createInstance({
      project: d.project,
      organization: d.organization,
      auditScope: d.auditScope,
      input: {
        name: d.input.name,
        type: 'development'
      }
    });

    return await this.getSandboxOrThrow({
      organization: d.organization,
      sandboxId: instance.id
    });
  }

  async updateSandbox(d: {
    sandbox: SandboxWithRelations;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name?: string;
    };
  }) {
    await this.ensureSandboxActive(d.sandbox);

    await this.updateInstance({
      instance: d.sandbox.instance,
      organization: d.organization,
      auditScope: d.auditScope,
      input: {
        name: d.input.name
      }
    });

    return await this.getSandboxOrThrow({
      organization: d.organization,
      sandboxId: d.sandbox.id
    });
  }

  async deleteInstance(d: {
    instance: Instance & {
      project: Project;
      resourceTenant: ResourceTenant | null;
      resourceGroup: ResourceGroup | null;
    };
    organization: Organization;
    auditScope: AuditScope;
  }) {
    await this.ensureInstanceActive(d.instance);

    throw new ServiceError(
      notImplementedError({
        message: 'Instance deletion is not supported yet'
      })
    );

    return {
      ...d.instance,
      organization: d.organization,
      sandbox: null
    };
  }

  async getInstanceById(d: {
    organization: Organization;
    instanceId: string;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
  }) {
    let instance = await db.instance.findFirst({
      where: {
        OR: [
          { id: d.instanceId },
          { slug: d.instanceId },
          { previousSlugs: { has: d.instanceId } }
        ],
        organizationOid: d.organization.oid
      },
      include: {
        organization: true,
        project: true,
        sandbox: true,
        resourceTenant: true,
        resourceGroup: true
      }
    });
    if (!instance) throw new ServiceError(notFoundError('instance', d.instanceId));

    return instance;
  }

  async listInstances(d: {
    organization: Organization;
    project?: Project;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
    projectIds?: string[];
    instanceIds?: string[];
    filterProjectIds?: string[];
    filterType?: InstanceType;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.instance.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              projectOid: d.project?.oid,
              status: 'active',
              type: d.filterType,
              id:
                (d.projectIds !== undefined || d.instanceIds !== undefined) &&
                !d.projectIds?.length &&
                !d.instanceIds?.length
                  ? { in: [] }
                  : d.filterProjectIds !== undefined && !d.filterProjectIds.length
                    ? { in: [] }
                    : undefined,
              AND: [
                ...(d.filterProjectIds?.length
                  ? [
                      {
                        project: {
                          OR: [
                            { id: { in: d.filterProjectIds } },
                            { slug: { in: d.filterProjectIds } },
                            { previousSlugs: { hasSome: d.filterProjectIds } }
                          ]
                        }
                      }
                    ]
                  : []),
                ...(d.projectIds !== undefined || d.instanceIds !== undefined
                  ? [
                      {
                        OR: [
                          ...(d.projectIds?.length
                            ? [
                                {
                                  project: {
                                    OR: [
                                      { id: { in: d.projectIds } },
                                      { slug: { in: d.projectIds } },
                                      { previousSlugs: { hasSome: d.projectIds } }
                                    ]
                                  }
                                }
                              ]
                            : []),
                          ...(d.instanceIds?.length
                            ? [
                                {
                                  id: { in: d.instanceIds }
                                },
                                {
                                  slug: { in: d.instanceIds }
                                },
                                {
                                  previousSlugs: { hasSome: d.instanceIds }
                                }
                              ]
                            : [])
                        ]
                      }
                    ]
                  : [])
              ]
            },
            include: {
              organization: true,
              project: true,
              sandbox: true
            }
          })
      )
    );
  }

  async getManyInstancesForOrganization(d: {
    organization: Organization;
    instanceIds?: string[];
  }) {
    return await db.instance.findMany({
      where: {
        OR: d.instanceIds
          ? [
              { id: { in: d.instanceIds } },
              { slug: { in: d.instanceIds } },
              { previousSlugs: { hasSome: d.instanceIds } }
            ]
          : undefined,
        organizationOid: d.organization.oid
      },
      include: {
        organization: true,
        project: true,
        sandbox: true
      }
    });
  }

  async getManyInstancesForUser(d: { user: User; instanceIds?: string[] }) {
    return await db.instance.findMany({
      where: {
        OR: d.instanceIds
          ? [
              { id: { in: d.instanceIds } },
              { slug: { in: d.instanceIds } },
              { previousSlugs: { hasSome: d.instanceIds } }
            ]
          : undefined,
        organization: {
          members: {
            some: {
              userOid: d.user.oid,
              status: 'active'
            }
          }
        }
      },
      include: {
        organization: true,
        project: true,
        sandbox: true
      }
    });
  }

  async getInstanceByIdForUser(d: { instanceId: string; user: User }) {
    let instance = await db.instance.findFirst({
      where: {
        OR: [
          { id: d.instanceId },
          { slug: d.instanceId },
          { previousSlugs: { has: d.instanceId } }
        ],
        organization: {
          members: {
            some: {
              userOid: d.user.oid,
              status: 'active'
            }
          }
        }
      },
      include: {
        organization: {
          include: {
            members: {
              where: {
                userOid: d.user.oid,
                status: 'active'
              },
              include: {
                actor: {
                  include: {
                    resourceActors: true
                  }
                }
              }
            }
          }
        },
        project: true,
        sandbox: true,
        resourceTenant: true,
        resourceGroup: true
      }
    });
    let member = instance?.organization.members[0];
    if (!instance || !member) {
      throw new ServiceError(notFoundError('instance', d.instanceId));
    }

    if (!member.lastActiveAt || differenceInMinutes(new Date(), member.lastActiveAt) > 30) {
      await db.organizationMember.update({
        where: { id: member.id },
        data: { lastActiveAt: new Date() }
      });
    }

    return {
      instance,
      member,
      actor: member.actor,
      project: instance.project,
      organization: instance.organization
    };
  }

  async getSandboxById(d: {
    organization: Organization;
    sandboxId: string;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
  }) {
    let sandbox = await this.getSandboxOrThrow({
      organization: d.organization,
      sandboxId: d.sandboxId
    });

    await this.ensureSandboxActive(sandbox);

    return sandbox;
  }

  async listSandboxes(d: {
    organization: Organization;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
    projectIds?: string[];
    instanceIds?: string[];
    filterProjectIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sandbox.findMany({
            ...opts,
            where: {
              status: 'active',
              instance: {
                organizationOid: d.organization.oid,
                status: 'active',
                type: 'development',
                id:
                  (d.projectIds !== undefined || d.instanceIds !== undefined) &&
                  !d.projectIds?.length &&
                  !d.instanceIds?.length
                    ? { in: [] }
                    : d.filterProjectIds !== undefined && !d.filterProjectIds.length
                      ? { in: [] }
                      : undefined,
                AND: [
                  ...(d.filterProjectIds?.length
                    ? [
                        {
                          project: {
                            OR: [
                              { id: { in: d.filterProjectIds } },
                              { slug: { in: d.filterProjectIds } },
                              { previousSlugs: { hasSome: d.filterProjectIds } }
                            ]
                          }
                        }
                      ]
                    : []),
                  ...(d.projectIds !== undefined || d.instanceIds !== undefined
                    ? [
                        {
                          OR: [
                            ...(d.projectIds?.length
                              ? [
                                  {
                                    project: {
                                      OR: [
                                        { id: { in: d.projectIds } },
                                        { slug: { in: d.projectIds } },
                                        { previousSlugs: { hasSome: d.projectIds } }
                                      ]
                                    }
                                  }
                                ]
                              : []),
                            ...(d.instanceIds?.length
                              ? [
                                  {
                                    id: { in: d.instanceIds }
                                  },
                                  {
                                    slug: { in: d.instanceIds }
                                  },
                                  {
                                    previousSlugs: { hasSome: d.instanceIds }
                                  }
                                ]
                              : [])
                          ]
                        }
                      ]
                    : [])
                ]
              }
            },
            include: {
              creatorActor: {
                include: {
                  organization: true
                }
              },
              instance: {
                include: {
                  organization: true,
                  project: true
                }
              }
            }
          })
      )
    );
  }
}

export let instanceService = Service.create(
  'instanceService',
  () => new InstanceService()
).build();
