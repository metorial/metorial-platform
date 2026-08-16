import { canonicalize } from '@lowerdeck/canonicalize';
import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveResourceActors,
  resolveSkills,
  resolveSkillTemplates,
  resolveStores
} from '@metorial/cargo-list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial/skills-search';
import {
  storeAccessService,
  storeReadPermission,
  storeService,
  storeVersionService,
  storeWritePermission
} from '@metorial/cargo-module-store';
import type {
  EntityImage,
  Instance,
  Prisma,
  Project,
  ResourceActor,
  StoreParticipantPermissions
} from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import {
  accessTagService,
  type AnyAccessTagSelector,
  assertResourceActorScope,
  assertResourceAuthorizationScope,
  consumerSkillReadRoles,
  type ResourceAuthorization
} from '@metorial/module-access';
import { internalImageService } from '../internal/image';
import { getProjectTenantIdentifier } from '../internal/scope';
import { enqueueSkillLifecycle } from '../queues/lifecycle';
import { skillResourceService } from './resource';
import { assertSkillRecordScope, getSkillMetadataWriteAccessWhere } from './skillAccess';
import { skillParticipantService } from './skillParticipant';
import type { SkillTemplateRecord } from './skillTemplate';

let skillInclude = {
  store: true,
  parentSkill: {
    select: {
      id: true
    }
  },
  parentSkillTemplate: {
    select: {
      id: true
    }
  }
} satisfies Prisma.SkillInclude;

export type SkillRecord = Prisma.SkillGetPayload<{
  include: typeof skillInclude;
}>;

export let getConsumerSkillAccessWhere = async (d: {
  accessTags?: AnyAccessTagSelector;
}): Promise<Prisma.SkillWhereInput | undefined> => {
  if (!d.accessTags) return undefined;

  let accessTagFilter = await accessTagService.getAccessTagFilter({
    tags: d.accessTags,
    roles: [...consumerSkillReadRoles]
  });

  let accessFilters: Prisma.SkillWhereInput[] = accessTagFilter
    ? [
        { accessTagEntities: accessTagFilter },
        {
          skillGroupItems: {
            some: {
              status: 'active',
              skillGroup: {
                status: 'active',
                accessTagEntities: accessTagFilter
              }
            }
          }
        }
      ]
    : [];
  return accessFilters.length ? { OR: accessFilters } : { oid: { in: [] } };
};

class SkillServiceImpl {
  private async getSkillRecord(d: {
    project: Project;
    instance: Instance;
    skillId: string;
    allowDeleted?: boolean;
    accessTags?: AnyAccessTagSelector;
  }) {
    let accessWhere = await getConsumerSkillAccessWhere(d);
    return await withTransaction(
      async db => {
        let skill = await db.skill.findFirst({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
            id: d.skillId,
            status: d.accessTags ? 'active' : d.allowDeleted ? undefined : 'active',
            AND: accessWhere ? [accessWhere] : undefined
          },
          include: skillInclude
        });

        if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

        return skill;
      },
      { ifExists: true }
    );
  }

  async createSkill(d: {
    project: Project;
    instance: Instance;
    parentSkill?: SkillRecord;
    parentSkillTemplate?: SkillTemplateRecord;
    parentSkillCloneType?: 'fork' | 'duplicate';
    input: {
      id: string;
      authorization: ResourceAuthorization;
      name: string;
      description?: string | null;
      metadata?: Prisma.InputJsonValue | null;
      clientName?: string | null;
      clientDescription?: string | null;
      clientMetadata?: Prisma.InputJsonValue | null;
      license?: string | null;
      compatibility?: string | null;
      imageFileId?: string | null;
    };
  }) {
    if (!d.input.name.trim()) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill name cannot be empty'
        })
      );
    }

    if (d.parentSkill && d.parentSkillTemplate) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill can only have one parent source'
        })
      );
    }

    let actor = d.input.authorization.resourceActor;
    let forkBaseSkillVersion =
      d.parentSkill && d.parentSkillCloneType === 'fork'
        ? await this.createForkBaseSkillVersion({
            parentSkill: d.parentSkill
          })
        : undefined;

    return await withTransaction(async db => {
      let store = d.parentSkillTemplate
        ? await storeService.createStoreFromTemplate({
            project: d.project,
            instance: d.instance,
            authorization: d.input.authorization,
            input: {
              templateId: d.parentSkillTemplate.storeTemplate!.id,
              name: d.input.name,
              actor,
              access: 'private',
              documentTitleOverrides: {
                '/SKILL.md': d.input.name
              }
            }
          })
        : d.parentSkill
          ? await storeService.cloneStore({
              project: d.project,
              instance: d.instance,
              store: d.parentSkill.store!,
              actor,
              authorization: d.input.authorization,
              defaultPermissions: [storeReadPermission],
              input: {
                name: d.input.name,
                access: 'private',
                cloneType:
                  d.parentSkillCloneType === 'duplicate' ? 'duplicate' : 'sync_until_change'
              }
            })
          : await storeService.createStore({
              project: d.project,
              instance: d.instance,
              input: {
                name: d.input.name,
                actor,
                access: 'private'
              }
            });

      let skill = await db.skill.create({
        data: {
          id: d.input.id,
          status: 'active',
          name: d.input.name,
          slug: `${slugify(d.input.name)}-${generatePlainId(5).toLowerCase()}`,
          description: d.input.description,
          metadata: d.input.metadata as any,

          clientName: d.input.clientName ?? d.input.name,
          clientDescription: d.input.clientDescription,
          clientMetadata: d.input.clientMetadata as any,
          license: d.input.license,
          compatibility: d.input.compatibility,

          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          organizationOid: d.project.organizationOid,
          storeId: store.id,
          skillEntityId: d.input.id,
          storeOid: store.oid,
          parentSkillOid: d.parentSkill?.oid,
          forkedFromSkillVersionOid: forkBaseSkillVersion?.oid,
          parentSkillTemplateOid: d.parentSkillTemplate?.oid,
          createdByResourceActorOid: actor?.oid
        },
        include: skillInclude
      });

      if (d.input.imageFileId !== undefined) {
        let image = await internalImageService.resolveImageEntityImage({
          project: d.project,
          instance: d.instance,
          entity: { id: skill.id, type: 'skill' },
          imageFileId: d.input.imageFileId,
          clearedImage: { type: 'default' },
          actor
        });

        skill = await db.skill.update({
          where: {
            id: skill.id
          },
          data: {
            image
          },
          include: skillInclude
        });
      }

      if (actor) {
        await skillParticipantService.ensureSkillParticipantRoles({
          skill,
          actor,
          roles: ['creator']
        });

        if (d.parentSkill && d.parentSkillCloneType === 'fork') {
          await skillParticipantService.ensureSkillParticipantRoles({
            skill: d.parentSkill,
            actor,
            roles: ['forker']
          });
        }
      }

      await enqueueSkillLifecycle({ skillId: skill.id, event: 'created' });

      return skill;
    });
  }

  private async createForkBaseSkillVersion(d: { parentSkill: SkillRecord }) {
    let snapshot = await storeVersionService.createStoreVersionSnapshotNow({
      storeId: d.parentSkill.store!.id
    });

    let skillVersion = await db.skillVersion.findFirst({
      where: {
        skillOid: d.parentSkill.oid,
        storeVersion: {
          id: snapshot.version.id
        }
      }
    });

    if (!skillVersion) {
      throw new ServiceError(
        badRequestError({
          message: `Failed to create fork base version for skill ${d.parentSkill.id}`
        })
      );
    }

    return skillVersion;
  }

  async listSkills(d: {
    project: Project;
    instance: Instance;
    ids?: string[];
    storeIds?: string[];
    parentSkillIds?: string[];
    parentSkillTemplateIds?: string[];
    createdByActorIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
    search?: string;
    statuses?: Array<'active' | 'archived' | 'deleted'>;
    skillGroupIds?: string[];
    integrationIds?: string[];
    providerIds?: string[];
    allowDeleted?: boolean;
    accessTags?: AnyAccessTagSelector;
  }) {
    let skills = await resolveSkills(d, d.ids);
    let stores = await resolveStores(d, d.storeIds);
    let parentSkills = await resolveSkills(d, d.parentSkillIds);
    let parentSkillTemplates = await resolveSkillTemplates(d, d.parentSkillTemplateIds);
    let createdByActors = await resolveResourceActors(d, d.createdByActorIds);
    let accessWhere = await getConsumerSkillAccessWhere(d);
    let delegatedResourceSkillIds: string[] | undefined;
    if (d.integrationIds?.length || d.providerIds?.length) {
      let instance = await db.instance.findFirst({
        where: {
          oid: d.instance.oid
        }
      });
      if (instance) {
        let candidates = await db.skill.findMany({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
            status: d.accessTags
              ? 'active'
              : d.statuses?.length
                ? { in: d.statuses }
                : d.allowDeleted
                  ? undefined
                  : 'active',
            AND: accessWhere ? [accessWhere] : undefined
          },
          select: { id: true }
        });
        let hydrated = [];
        for (let offset = 0; offset < candidates.length; offset += 100) {
          hydrated.push(
            ...(await skillResourceService.hydrateDelegatedSkillResources({
              instance,
              skillIds: candidates.slice(offset, offset + 100).map(skill => skill.id)
            }))
          );
        }
        delegatedResourceSkillIds = hydrated
          .filter(resource => {
            let integrationMatch =
              !d.integrationIds?.length ||
              resource.integrations.some(integration =>
                d.integrationIds!.includes(integration.id)
              );
            let providerMatch =
              !d.providerIds?.length ||
              resource.providers.some(provider => d.providerIds!.includes(provider.id));
            return integrationMatch && providerMatch;
          })
          .map(resource => resource.skillId);
      } else {
        delegatedResourceSkillIds = [];
      }
    }
    let normalizedSearch = d.search?.trim() || undefined;
    let search = normalizedSearch
      ? await voyager.record.search({
          tenantId: getProjectTenantIdentifier(d.project),
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.skill.id,
          query: normalizedSearch
        })
      : null;
    let andFilters: Prisma.SkillWhereInput[] = [];
    if (skills) andFilters.push({ oid: skills.in });
    if (stores) andFilters.push({ storeOid: stores.in });
    if (parentSkills) andFilters.push({ parentSkillOid: parentSkills.in });
    if (parentSkillTemplates) {
      andFilters.push({ parentSkillTemplateOid: parentSkillTemplates.in });
    }
    if (createdByActors) {
      andFilters.push({ createdByResourceActorOid: createdByActors.in });
    }
    if (d.createdAt) andFilters.push({ createdAt: normalizeDateFilter(d.createdAt) });
    if (d.updatedAt) andFilters.push({ updatedAt: normalizeDateFilter(d.updatedAt) });
    if (search) andFilters.push({ id: { in: search.map(result => result.documentId) } });
    if (accessWhere) andFilters.push(accessWhere);
    if (d.integrationIds?.length || d.providerIds?.length) {
      andFilters.push({ id: { in: delegatedResourceSkillIds ?? [] } });
    }
    if (d.skillGroupIds?.length) {
      andFilters.push({
        skillGroupItems: {
          some: {
            status: 'active',
            skillGroup: { id: { in: d.skillGroupIds } }
          }
        }
      });
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skill.findMany({
            ...opts,
            where: {
              projectOid: d.project.oid,
              instanceOid: d.instance.oid,
              status: d.accessTags
                ? 'active'
                : d.statuses?.length
                  ? { in: d.statuses }
                  : d.allowDeleted
                    ? undefined
                    : 'active',
              AND: andFilters
            },
            include: skillInclude
          })
      )
    );
  }

  async getSkillById(d: {
    project: Project;
    instance: Instance;
    skillId: string;
    allowDeleted?: boolean;
    accessTags?: AnyAccessTagSelector;
  }) {
    return await this.getSkillRecord(d);
  }

  async assertSkillWriteAccess(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    assertResourceAuthorizationScope(d);
    assertSkillRecordScope(d);
    if (d.authorization.type == 'restricted') {
      let accessWhere = await getSkillMetadataWriteAccessWhere(d);
      let writableSkill = await db.skill.findFirst({
        where: accessWhere!,
        select: { oid: true }
      });
      if (!writableSkill) {
        throw new ServiceError(
          forbiddenError({
            message: 'Consumer does not have write access to this skill.'
          })
        );
      }
    }

    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store: d.skill.store!,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });
  }

  async updateSkill(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    input: {
      name?: string;
      description?: string | null;
      metadata?: Prisma.InputJsonValue | null;
      clientName?: string | null;
      clientDescription?: string | null;
      clientMetadata?: Prisma.InputJsonValue | null;
      license?: string | null;
      compatibility?: string | null;
      imageFileId?: string | null;
      image?: EntityImage | null;
    };
  }) {
    if (
      d.input.name === undefined &&
      d.input.description === undefined &&
      d.input.metadata === undefined &&
      d.input.clientName === undefined &&
      d.input.clientDescription === undefined &&
      d.input.clientMetadata === undefined &&
      d.input.license === undefined &&
      d.input.compatibility === undefined &&
      d.input.imageFileId === undefined &&
      d.input.image === undefined
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one skill field must be updated'
        })
      );
    }

    await this.assertSkillWriteAccess(d);

    if (d.input.name !== undefined && !d.input.name.trim()) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill name cannot be empty'
        })
      );
    }

    let nextImage = d.input.image;
    if (d.input.imageFileId !== undefined) {
      nextImage = await internalImageService.resolveImageEntityImage({
        project: d.project,
        instance: d.instance,
        entity: { id: d.skill.id, type: 'skill' },
        imageFileId: d.input.imageFileId,
        clearedImage: { type: 'default' },
        actor: d.authorization.resourceActor,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions
      });
    }

    let store = d.input.name
      ? await storeService.updateStore({
          project: d.project,
          instance: d.instance,
          store: d.skill.store!,
          authorization: d.authorization,
          input: {
            name: d.input.name
          }
        })
      : d.skill.store;

    if (
      d.input.name !== undefined ||
      d.input.description !== undefined ||
      d.input.metadata !== undefined ||
      d.input.clientName !== undefined ||
      d.input.clientDescription !== undefined ||
      d.input.clientMetadata !== undefined ||
      d.input.license !== undefined ||
      d.input.compatibility !== undefined ||
      d.input.imageFileId !== undefined ||
      d.input.image !== undefined
    ) {
      await db.skill.update({
        where: {
          id: d.skill.id
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata as any,
          clientName: d.input.clientName,
          clientDescription: d.input.clientDescription,
          clientMetadata: d.input.clientMetadata as any,
          license: d.input.license,
          compatibility: d.input.compatibility,
          image: nextImage as any
        }
      });

      if (d.input.imageFileId !== undefined || d.input.image !== undefined) {
        await internalImageService.cleanupImageEntityImage({
          image:
            d.skill.image && canonicalize(d.skill.image) !== canonicalize(nextImage)
              ? (d.skill.image as EntityImage)
              : undefined
        });
      }
    }

    await enqueueSkillLifecycle({ skillId: d.skill.id, event: 'updated' });

    return await this.getSkillRecord({
      project: d.project,
      instance: d.instance,
      skillId: d.skill.id
    }).then(skill => ({ ...skill, store }) satisfies SkillRecord);
  }

  async archiveSkill(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    await this.assertSkillWriteAccess(d);

    await withTransaction(async db => {
      await db.skillPluginSkill.updateMany({
        where: {
          skillOid: d.skill.oid,
          status: 'active'
        },
        data: {
          status: 'archived',
          clientName: null,
          clientDescription: null,
          clientMetadata: null,
          license: null,
          compatibility: null,
          skillConfigurationOid: null
        }
      });

      await db.skill.update({
        where: {
          id: d.skill.id
        },
        data: {
          status: 'archived'
        }
      });

      await enqueueSkillLifecycle({ skillId: d.skill.id, event: 'archived' });
    });

    return d.skill;
  }

  async markSkillUse(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    actor: ResourceActor;
  }) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.actor
    });
    await storeAccessService.ensureActorStorePermissions({
      store: d.skill.store!,
      actor: d.actor,
      permissions: d.actor.organizationActorOid
        ? [storeReadPermission, storeWritePermission]
        : [storeReadPermission]
    });
    await skillParticipantService.ensureSkillParticipantAccessRole({
      skill: d.skill,
      actor: d.actor,
      permission: d.actor.organizationActorOid ? 'write' : 'read'
    });

    if (d.actor.consumerProfileOid) {
      return await skillParticipantService.ensureSkillParticipantRoles({
        skill: d.skill,
        actor: d.actor,
        roles: ['user']
      });
    }
  }
}

export let skillService = Service.create(
  'cargoSkillService',
  () => new SkillServiceImpl()
).build();
