import { canonicalize } from '@lowerdeck/canonicalize';
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
import { createAuditScope, createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  ConsumerProfile,
  db,
  ID,
  Organization,
  OrganizationActor,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCode } from '@metorial/id';
import { differenceInMinutes } from 'date-fns';
import { cleanupFileImage, resolveFileImage } from '../lib/fileImage';
import { syncBrandOrganizationQueue } from '../queues/syncBrand';
import { syncProfileQueue } from '../queues/syncProfile';
import { authBootstrapService } from './authBootstrap';
import { namespaceService } from './namespace';
import { organizationActorService } from './organizationActor';
import { organizationMemberService } from './organizationMember';
import { projectService } from './project';

let getOrgSlug = createSlugGenerator(
  async slug =>
    !(await db.organization.findFirst({
      where: {
        OR: [{ slug }, { previousSlugs: { has: slug } }]
      }
    })) && !(await db.cellOrganization.findFirst({ where: { slug } }))
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

class OrganizationService {
  private async ensureOrganizationActive(organization: Organization) {
    if (organization.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted organization'
        })
      );
    }
  }

  private async reclaimOrganizationSlugOrThrow(d: {
    slug: string;
    organization?: Organization;
  }) {
    await withTransaction(
      async db => {
        let currentSlugOrganization = await db.organization.findFirst({
          where: {
            slug: d.slug,
            id: d.organization ? { not: d.organization.id } : undefined
          }
        });
        let existingCellOrganization = await db.cellOrganization.findFirst({
          where: { slug: d.slug }
        });

        if (currentSlugOrganization || existingCellOrganization) {
          throw new ServiceError(
            conflictError({
              message: 'An organization with this slug already exists'
            })
          );
        }

        let previousSlugOrganizations = await db.organization.findMany({
          where: {
            previousSlugs: { has: d.slug },
            id: d.organization ? { not: d.organization.id } : undefined
          },
          select: {
            oid: true,
            previousSlugs: true
          }
        });

        for (let organization of previousSlugOrganizations) {
          await db.organization.update({
            where: { oid: organization.oid },
            data: {
              previousSlugs: organization.previousSlugs.filter(slug => slug !== d.slug)
            }
          });
        }
      },
      { ifExists: true }
    );
  }

  async createOrganization(d: {
    input: {
      name: string;
      image?: PrismaJson.EntityImage;
    };
    context: Context;
    performedBy: User;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.created:before', d);

      let organization = await db.organization.create({
        data: {
          id: await ID.generateId('organization'),
          status: 'active',
          type: 'default',
          authVersion: 'v2',
          slug: await getOrgSlug({ input: `${d.input.name}-${generateCode(3)}` }),
          name: d.input.name,
          image: d.input.image ?? { type: 'default' }
        }
      });

      await Fabric.fire('organization.created:after', {
        ...d,
        organization,
        performedBy: d.performedBy
      });

      let systemActor = await organizationActorService.createOrganizationActor({
        input: {
          type: 'primary_system',
          name: 'Metorial',
          image: {
            type: 'url',
            url: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
          }
        },
        organization,
        auditScope: createAuditScope({
          organization,
          actor: { type: 'system', id: d.performedBy.id },
          context: d.context
        })
      });

      await authBootstrapService.ensureOrganizationAuthVersionV2({
        organization,
        auditScope: createOrganizationActorAuditScope({
          organization,
          organizationActor: systemActor,
          context: d.context
        })
      });

      let member = await organizationMemberService.createOrganizationMember({
        user: d.performedBy,
        organization,
        input: { role: 'admin' },
        auditScope: createOrganizationActorAuditScope({
          organization,
          organizationActor: systemActor,
          context: d.context
        })
      });

      await Fabric.fire('organization.initialized:after', {
        organization,
        auditScope: {
          organizationOid: organization.oid,
          organizationActorOid: member.actor.oid,
          actor: {
            type: 'org_actor',
            id: member.actor.id
          },
          context: d.context
        }
      });

      await syncProfileQueue.add({ organizationId: organization.id }, { delay: 5000 });
      await syncBrandOrganizationQueue.add(
        { organizationId: organization.id },
        { delay: 5000 }
      );

      return {
        organization,
        member,
        actor: member.actor
      };
    });
  }

  async updateOrganization(d: {
    input: {
      name?: string;
      slug?: string;
      image?: PrismaJson.EntityImage;
      imageFileId?: string | null;
    };
    organization: Organization;
    auditScope: AuditScope;
  }) {
    await this.ensureOrganizationActive(d.organization);

    return withTransaction(async db => {
      await Fabric.fire('organization.updated:before', d);

      let nextImage = d.input.image;
      if (d.input.slug && d.input.slug != d.organization.slug) {
        await this.reclaimOrganizationSlugOrThrow({
          slug: d.input.slug,
          organization: d.organization
        });
      }

      if (d.input.imageFileId !== undefined) {
        nextImage = await resolveFileImage({
          imageFileId: d.input.imageFileId,
          clearedImage: { type: 'default' },
          owner: {
            type: 'organization',
            organization: d.organization
          },
          entity: {
            type: 'organization',
            id: d.organization.id
          }
        });
      }

      let organization = await db.organization.update({
        where: { id: d.organization.id },
        data: {
          name: d.input.name,
          slug: d.input.slug,
          previousSlugs:
            d.input.slug && d.input.slug !== d.organization.slug
              ? getNextPreviousSlugs({
                  previousSlugs: d.organization.previousSlugs ?? [],
                  currentSlug: d.organization.slug,
                  nextSlug: d.input.slug
                })
              : undefined,
          image: nextImage
        }
      });

      if (d.input.image !== undefined || d.input.imageFileId !== undefined) {
        await cleanupFileImage(
          d.organization.image &&
            canonicalize(d.organization.image) !== canonicalize(nextImage)
            ? d.organization.image
            : undefined
        );
      }

      await Fabric.fire('organization.updated:after', {
        input: d.input,
        organization,
        previousOrganization: d.organization,
        auditScope: d.auditScope
      });

      await addAfterTransactionHook(() =>
        syncProfileQueue.add({ organizationId: organization.id }, { delay: 5000 })
      );
      await addAfterTransactionHook(() =>
        syncBrandOrganizationQueue.add({ organizationId: organization.id }, { delay: 5000 })
      );

      return organization;
    });
  }

  async deleteOrganization(d: { organization: Organization; auditScope: AuditScope }) {
    await this.ensureOrganizationActive(d.organization);

    throw new ServiceError(
      notImplementedError({
        message: 'Deleting organizations is not supported yet'
      })
    );

    return d.organization;
  }

  async getOrganizationByIdForUser(d: { organizationId: string; user: { id: string } }) {
    let org = await db.organization.findFirst({
      where: {
        OR: [
          { id: d.organizationId },
          { slug: d.organizationId },
          { previousSlugs: { has: d.organizationId } }
        ],
        members: {
          some: {
            user: { id: d.user.id },
            status: 'active'
          }
        }
      },
      include: {
        members: {
          where: {
            user: { id: d.user.id },
            status: 'active'
          },
          include: {
            actor: true,
            user: true
          }
        }
      }
    });
    let member = org?.members[0];
    if (!org || !member) {
      throw new ServiceError(notFoundError('organization', d.organizationId));
    }

    if (!member.lastActiveAt || differenceInMinutes(new Date(), member.lastActiveAt) > 30) {
      await db.organizationMember.update({
        where: { id: member.id },
        data: { lastActiveAt: new Date() }
      });
    }

    return {
      organization: org,
      member,
      actor: member.actor
    };
  }

  async listOrganizations(d: {
    filter: { type: 'actor'; actor: OrganizationActor } | { type: 'user'; user: User };
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.organization.findMany({
            ...opts,
            where: {
              status: 'active',

              actors:
                d.filter.type === 'actor'
                  ? {
                      some: {
                        oid: d.filter.actor.oid
                      }
                    }
                  : undefined,

              members:
                d.filter.type === 'user'
                  ? {
                      some: {
                        userOid: d.filter.user.oid,
                        status: 'active'
                      }
                    }
                  : undefined
            }
          })
      )
    );
  }

  async bootUser(d: { user: User }) {
    let orgs = await db.organization.findMany({
      where: {
        members: {
          some: {
            userOid: d.user.oid,
            status: 'active'
          }
        }
      },
      orderBy: { id: 'asc' },
      include: {
        members: {
          where: {
            userOid: d.user.oid,
            status: 'active'
          },
          include: {
            actor: {
              include: {
                teams: {
                  include: {
                    team: true
                  }
                }
              }
            }
          }
        }
        // projects: {
        //   orderBy: { id: 'asc' }
        // },
        // instances: {
        //   include: {
        //     project: true
        //   },
        //   orderBy: { id: 'asc' }
        // }
      }
    });

    // return {
    //   user: d.user,
    //   organizations: orgs.map(org => ({
    //     ...org,
    //     member: org.members[0]
    //   })),
    //   projects: orgs.flatMap(org =>
    //     org.projects.map(project => ({ ...project, organization: org }))
    //   ),
    //   instances: orgs.flatMap(org =>
    //     org.instances.map(instance => ({
    //       ...instance,
    //       organization: org,
    //       project: instance.project
    //     }))
    //   )
    // };

    let namespacesByOrganizationOid =
      await namespaceService.getNamespacePropertiesByOrganizationOid({ organizations: orgs });

    let orgsWithProjectAndInstances = await Promise.all(
      orgs.map(async org => {
        let projects = await projectService.getAllProjects({
          organization: org,
          actor: org.members[0].actor,
          member: org.members[0]
        });

        return {
          ...org,
          member: org.members[0],
          namespaces: namespacesByOrganizationOid.get(org.oid) ?? [],
          projects,
          instances: projects.flatMap(p => p.instances.map(i => ({ ...i, project: p })))
        };
      })
    );

    return {
      user: d.user,
      organizations: orgsWithProjectAndInstances,
      projects: orgsWithProjectAndInstances.flatMap(org =>
        org.projects.map(project => ({ ...project, organization: org }))
      ),
      instances: orgsWithProjectAndInstances.flatMap(org =>
        org.instances.map(instance => ({
          ...instance,
          organization: org,
          project: instance.project
        }))
      )
    };
  }

  async bootConsumer(d: { consumerProfile: ConsumerProfile }) {
    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.consumerProfile.instanceOid },
      include: {
        project: {
          include: {
            organization: true
          }
        }
      }
    });

    let org = instance.project.organization;
    let orgsWithProjectAndInstances = [
      {
        ...org,
        projects: [
          {
            ...instance.project,
            organization: org,
            instances: [instance]
          }
        ],
        instances: [instance]
      }
    ];

    let [firstName, ...rest] = d.consumerProfile.name.split(' ');
    let lastName = rest.join(' ');

    return {
      user: {
        id: d.consumerProfile.id,
        status: 'active' as const,
        type: 'consumer' as const,
        email: d.consumerProfile.email,
        name: d.consumerProfile.name,
        firstName: firstName,
        lastName: lastName,
        image: { type: 'default' as const },
        createdAt: d.consumerProfile.createdAt,
        updatedAt: d.consumerProfile.updatedAt
      },
      organizations: orgsWithProjectAndInstances,
      projects: orgsWithProjectAndInstances.flatMap(org =>
        org.projects.map(project => ({ ...project, organization: org }))
      ),
      instances: orgsWithProjectAndInstances.flatMap(org =>
        org.instances.map(instance => ({
          ...instance,
          organization: org,
          project: instance.project
        }))
      )
    };
  }
}

export let organizationService = Service.create(
  'organizationService',
  () => new OrganizationService()
).build();
