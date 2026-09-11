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
  addAfterTransactionHook,
  addAwaitedAfterTransactionHook,
  db,
  ID,
  Organization,
  OrganizationActor,
  OrganizationMember,
  Project,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCode } from '@metorial/id';
import { metorialResourceService } from '@metorial-subspace/module-tenant';
import { syncBrandQueue } from '../queues/syncBrand';
import { instanceService } from './instance';

let getProjectSlug = createSlugGenerator(
  async slug =>
    !(await db.project.findFirst({
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

class ProjectService {
  private async ensureProjectActive(project: Project) {
    if (project.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted project'
        })
      );
    }
  }

  private async reclaimProjectSlugOrThrow(d: { slug: string; project?: Project }) {
    await withTransaction(
      async db => {
        let currentSlugProject = await db.project.findFirst({
          where: {
            slug: d.slug,
            id: d.project ? { not: d.project.id } : undefined
          }
        });

        if (currentSlugProject) {
          throw new ServiceError(
            conflictError({
              message: 'A project with this slug already exists'
            })
          );
        }

        let previousSlugProjects = await db.project.findMany({
          where: {
            previousSlugs: { has: d.slug },
            id: d.project ? { not: d.project.id } : undefined
          },
          select: {
            oid: true,
            previousSlugs: true
          }
        });

        for (let project of previousSlugProjects) {
          await db.project.update({
            where: { oid: project.oid },
            data: {
              previousSlugs: project.previousSlugs.filter(slug => slug !== d.slug)
            }
          });
        }
      },
      { ifExists: true }
    );
  }

  async createProject(d: {
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name: string;
      magicMcpSessionDurationMinutes?: number;
    };
  }) {
    return await withTransaction(async db => {
      await Fabric.fire('organization.project.created:before', d);

      let project = await db.project.create({
        data: {
          id: await ID.generateId('project'),
          status: 'active',
          slug: await getProjectSlug({ input: `${d.input.name}-${generateCode(5)}` }),
          name: d.input.name,
          magicMcpSessionDurationMinutes: d.input.magicMcpSessionDurationMinutes,
          autoAddOrganizationMembersToPortals: true,
          organizationOid: d.organization.oid
        },
        include: {
          organization: true
        }
      });

      // The instance copies itself, and its own copy pulls the project along.
      await instanceService.createInstance({
        project,
        organization: d.organization,
        auditScope: d.auditScope,
        input: {
          name: `Production`,
          type: 'production'
        }
      });

      await addAfterTransactionHook(() => syncBrandQueue.add({ projectId: project.id }));

      await Fabric.fire('organization.project.created:after', {
        organization: d.organization,
        input: d.input,
        project,
        auditScope: d.auditScope
      });

      return project;
    });
  }

  async updateProject(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name?: string;
      slug?: string;
      onlyAllowTrustedProviders?: boolean;
      magicMcpSessionDurationMinutes?: number;
    };
  }) {
    await this.ensureProjectActive(d.project);

    return await withTransaction(async db => {
      await Fabric.fire('organization.project.updated:before', d);

      if (d.input.slug && d.input.slug !== d.project.slug) {
        await this.reclaimProjectSlugOrThrow({
          slug: d.input.slug,
          project: d.project
        });
      }

      let project = await db.project.update({
        where: { oid: d.project.oid },
        data: {
          name: d.input.name,
          slug: d.input.slug,
          previousSlugs:
            d.input.slug && d.input.slug !== d.project.slug
              ? getNextPreviousSlugs({
                  previousSlugs: d.project.previousSlugs ?? [],
                  currentSlug: d.project.slug,
                  nextSlug: d.input.slug
                })
              : undefined,
          onlyAllowTrustedProviders: d.input.onlyAllowTrustedProviders,
          magicMcpSessionDurationMinutes: d.input.magicMcpSessionDurationMinutes
        },
        include: {
          organization: true
        }
      });

      await addAfterTransactionHook(() => syncBrandQueue.add({ projectId: project.id }));

      await Fabric.fire('organization.project.updated:after', {
        organization: d.organization,
        input: d.input,
        project,
        previousProject: d.project,
        auditScope: d.auditScope
      });

      await addAwaitedAfterTransactionHook(() => metorialResourceService.syncProject(project));

      return project;
    });
  }

  async deleteProject(d: {
    project: Project;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    await this.ensureProjectActive(d.project);

    throw new ServiceError(
      notImplementedError({
        message: 'Project deletion is not supported yet'
      })
    );

    return {
      ...d.project,
      organization: d.organization
    };
  }

  async getProjectById(d: {
    organization: Organization;
    projectId: string;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
  }) {
    let project = await db.project.findFirst({
      where: {
        OR: [
          { id: d.projectId },
          { slug: d.projectId },
          { previousSlugs: { has: d.projectId } }
        ],
        organizationOid: d.organization.oid
      },
      include: {
        organization: true
      }
    });
    if (!project) throw new ServiceError(notFoundError('project', d.projectId));

    return project;
  }

  async listProjects(d: {
    organization: Organization;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
    projectIds?: string[];
    teamIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.project.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'active',
              OR: d.projectIds
                ? [
                    { id: { in: d.projectIds } },
                    { slug: { in: d.projectIds } },
                    { previousSlugs: { hasSome: d.projectIds } }
                  ]
                : undefined
            },
            include: {
              organization: true
            }
          })
      )
    );
  }

  async getAllProjects(d: {
    organization: Organization;
    actor: OrganizationActor;
    member: OrganizationMember | undefined;
  }) {
    return await db.project.findMany({
      where: {
        organizationOid: d.organization.oid,
        status: 'active'
      },
      include: {
        organization: true,
        instances: true
      }
    });
  }

  async getManyProjectsByIds(d: { organization: Organization; projectIds: string[] }) {
    let projects = await db.project.findMany({
      where: {
        organizationOid: d.organization.oid,
        OR: [
          { id: { in: d.projectIds } },
          { slug: { in: d.projectIds } },
          { previousSlugs: { hasSome: d.projectIds } }
        ]
      },
      include: {
        organization: true
      }
    });

    return projects;
  }
}

export let projectService = Service.create(
  'projectService',
  () => new ProjectService()
).build();
