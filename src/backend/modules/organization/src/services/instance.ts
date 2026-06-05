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
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  db,
  ID,
  Instance,
  InstanceType,
  Organization,
  OrganizationActor,
  OrganizationMember,
  Project,
  Sandbox,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCode } from '@metorial/id';
import { differenceInMinutes } from 'date-fns';
import { syncSubspaceTenantQueue } from '../queues/syncSubspaceTenant';

let getInstanceSlug = createSlugGenerator(
  async slug =>
    !(await db.instance.findFirst({
      where: {
        OR: [{ slug }, { previousSlugs: { has: slug } }]
      }
    }))
);

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

  private async reclaimInstanceSlugOrThrow(d: { slug: string; instance?: Instance }) {
    await withTransaction(
      async db => {
        let currentSlugInstance = await db.instance.findFirst({
          where: {
            slug: d.slug,
            id: d.instance ? { not: d.instance.id } : undefined
          }
        });

        if (currentSlugInstance) {
          throw new ServiceError(
            conflictError({
              message: 'An instance with this slug already exists'
            })
          );
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

  private async syncInstanceCompanions(d: {
    instance: Instance;
    performedBy: OrganizationActor;
  }) {
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
              creatorActorOid: d.performedBy.oid
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
                creatorActorOid: d.performedBy.oid
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
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name: string;
      type: InstanceType;
    };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.project.instance.created:before', d);

      if (d.input.type === 'production') {
        await this.ensureCanCreateProductionInstance({ project: d.project });
      }

      let instance = await db.instance.create({
        data: {
          id: await ID.generateId('instance'),
          status: 'active',
          slug: await getInstanceSlug({ input: `${d.input.name}-${generateCode(5)}` }),
          name: d.input.name,
          type: d.input.type,
          hasBeenReconciled: true,
          organizationOid: d.organization.oid,
          projectOid: d.project.oid
        },
        include: {
          organization: true,
          project: true,
          sandbox: true
        }
      });

      await this.syncInstanceCompanions({
        instance,
        performedBy: d.performedBy
      });

      await addAfterTransactionHook(() =>
        syncSubspaceTenantQueue.add({ projectId: d.project.id })
      );

      await Fabric.fire('organization.project.instance.created:after', {
        ...d,
        instance,
        performedBy: d.performedBy
      });

      return instance;
    });
  }

  async updateInstance(d: {
    instance: Instance & { project: Project };
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name?: string;
      slug?: string;
      type?: InstanceType;
    };
  }) {
    await this.ensureInstanceActive(d.instance);

    return withTransaction(async db => {
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
          sandbox: true
        }
      });

      await this.syncInstanceCompanions({
        instance,
        performedBy: d.performedBy
      });

      await addAfterTransactionHook(() =>
        syncSubspaceTenantQueue.add({ projectId: d.instance.project.id })
      );

      await Fabric.fire('organization.project.instance.updated:after', {
        ...d,
        instance,
        performedBy: d.performedBy,
        project: d.instance.project
      });

      return instance;
    });
  }

  async createSandbox(d: {
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name: string;
    };
  }) {
    let instance = await this.createInstance({
      project: d.project,
      organization: d.organization,
      performedBy: d.performedBy,
      context: d.context,
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
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name?: string;
    };
  }) {
    await this.ensureSandboxActive(d.sandbox);

    await this.updateInstance({
      instance: d.sandbox.instance,
      organization: d.organization,
      performedBy: d.performedBy,
      context: d.context,
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
    instance: Instance & { project: Project };
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
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
        sandbox: true
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
                actor: true
              }
            }
          }
        },
        project: true,
        sandbox: true
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

  async reconcileProjectInstances(d: {
    project: Project & { organization: Organization };
    performedBy: OrganizationActor;
    context: Context;
  }) {
    return withTransaction(async db => {
      let instances = await db.instance.findMany({
        where: {
          projectOid: d.project.oid,
          status: 'active',
          hasBeenReconciled: false
        },
        orderBy: { createdAt: 'asc' },
        include: {
          organization: true,
          project: true
        }
      });

      if (instances.length === 0) return { reconciled: 0 };

      let productionInstance = await db.instance.findFirst({
        where: {
          projectOid: d.project.oid,
          status: 'active',
          type: 'production'
        },
        select: {
          id: true
        }
      });
      let promotedInstanceId: string | undefined;

      if (!productionInstance) {
        let oldestDevelopmentInstance = instances[0];
        let slug = await getInstanceSlug({ input: `Production-${generateCode(5)}` });

        let instance = await db.instance.update({
          where: { oid: oldestDevelopmentInstance.oid },
          data: {
            name: 'Production',
            slug,
            previousSlugs: getNextPreviousSlugs({
              previousSlugs: oldestDevelopmentInstance.previousSlugs ?? [],
              currentSlug: oldestDevelopmentInstance.slug,
              nextSlug: slug
            }),
            type: 'production',
            hasBeenReconciled: true
          },
          include: {
            organization: true,
            project: true
          }
        });

        promotedInstanceId = instance.id;

        await this.syncInstanceCompanions({
          instance,
          performedBy: d.performedBy
        });
      }

      for (let instance of instances) {
        if (instance.id === promotedInstanceId) continue;

        await this.syncInstanceCompanions({
          instance,
          performedBy: d.performedBy
        });

        await db.instance.update({
          where: { oid: instance.oid },
          data: {
            hasBeenReconciled: true
          }
        });
      }

      await addAfterTransactionHook(() =>
        syncSubspaceTenantQueue.add({ projectId: d.project.id })
      );

      return { reconciled: instances.length };
    });
  }
}

export let instanceService = Service.create(
  'instanceService',
  () => new InstanceService()
).build();
