import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { EntityImage, Prisma, StoreParticipantPermissions } from '@metorial-cargo/db';
import { db, snowflake, withTransaction } from '@metorial-cargo/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkills,
  resolveSkillTemplates,
  resolveStores,
  resolveTenantActors
} from '@metorial-cargo/list-utils';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { actorService } from '@metorial-cargo/module-file';
import {
  storeAccessService,
  storeReadPermission,
  storeService,
  storeVersionService
} from '@metorial-cargo/module-store';
import { internalImageService } from '../internal/image';
import { enqueueSkillLifecycle } from '../queues/lifecycle';
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

class SkillServiceImpl {
  private async getSkillRecord(d: CargoTenantEnvironment & { skillId: string }) {
    return await withTransaction(
      async db => {
        let skill = await db.skill.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            id: d.skillId,
            status: 'active'
          },
          include: skillInclude
        });

        if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

        return skill;
      },
      { ifExists: true }
    );
  }

  async createSkill(
    d: CargoTenantEnvironment & {
      parentSkill?: SkillRecord;
      parentSkillTemplate?: SkillTemplateRecord;
      parentSkillCloneType?: 'fork' | 'duplicate';
      input: {
        id: string;
        slug?: string | null;
        actorId?: string;
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
    }
  ) {
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

    let actor = d.input.actorId
      ? await actorService.getActorById({
          tenant: d.tenant,
          actorId: d.input.actorId
        })
      : undefined;
    let forkBaseSkillVersion =
      d.parentSkill && d.parentSkillCloneType === 'fork'
        ? await this.createForkBaseSkillVersion({
            parentSkill: d.parentSkill
          })
        : undefined;

    return await withTransaction(async db => {
      let store = d.parentSkillTemplate
        ? await storeService.createStoreFromTemplate({
            tenant: d.tenant,
            environment: d.environment,
            input: {
              templateId: d.parentSkillTemplate.storeTemplate.id,
              name: d.input.name,
              actor,
              access: 'private'
            }
          })
        : d.parentSkill
          ? await storeService.cloneStore({
              tenant: d.tenant,
              environment: d.environment,
              store: d.parentSkill.store,
              actor,
              defaultPermissions: [storeReadPermission],
              input: {
                name: d.input.name,
                access: 'private',
                cloneType:
                  d.parentSkillCloneType === 'duplicate' ? 'duplicate' : 'sync_until_change'
              }
            })
          : await storeService.createStore({
              tenant: d.tenant,
              environment: d.environment,
              input: {
                name: d.input.name,
                actor,
                access: 'private'
              }
            });

      let skill = await db.skill.create({
        data: {
          oid: snowflake.nextId(),
          id: d.input.id,
          status: 'active',
          name: d.input.name,
          slug: d.input.slug ?? null,
          description: d.input.description,
          metadata: d.input.metadata as any,

          clientName: d.input.clientName ?? d.input.name,
          clientDescription: d.input.clientDescription,
          clientMetadata: d.input.clientMetadata as any,
          license: d.input.license,
          compatibility: d.input.compatibility,

          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          storeOid: store.oid,
          parentSkillOid: d.parentSkill?.oid,
          forkedFromSkillVersionOid: forkBaseSkillVersion?.oid,
          parentSkillTemplateOid: d.parentSkillTemplate?.oid,
          createdByTenantActorOid: actor?.oid
        },
        include: skillInclude
      });

      if (d.input.imageFileId !== undefined) {
        let image = await internalImageService.resolveImageEntityImage({
          tenant: d.tenant,
          environment: d.environment,
          entity: { id: skill.id, type: 'skill' },
          imageFileId: d.input.imageFileId,
          clearedImage: { type: 'default' },
          actorId: d.input.actorId
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

      await skillParticipantService.syncSkillParticipantsFromStore({ skill });

      await enqueueSkillLifecycle({ skillId: skill.id, event: 'created' });

      return skill;
    });
  }

  private async createForkBaseSkillVersion(d: { parentSkill: SkillRecord }) {
    let snapshot = await storeVersionService.createStoreVersionSnapshotNow({
      storeId: d.parentSkill.store.id
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

  async listSkills(
    d: CargoTenantEnvironment & {
      ids?: string[];
      storeIds?: string[];
      parentSkillIds?: string[];
      parentSkillTemplateIds?: string[];
      createdByActorIds?: string[];
      createdAt?: DateFilter;
    }
  ) {
    let skills = await resolveSkills(d, d.ids);
    let stores = await resolveStores(d, d.storeIds);
    let parentSkills = await resolveSkills(d, d.parentSkillIds);
    let parentSkillTemplates = await resolveSkillTemplates(d, d.parentSkillTemplateIds);
    let createdByActors = await resolveTenantActors(d, d.createdByActorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skill.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              status: 'active',
              AND: [
                skills ? { oid: skills.in } : undefined!,
                stores ? { storeOid: stores.in } : undefined!,
                parentSkills ? { parentSkillOid: parentSkills.in } : undefined!,
                parentSkillTemplates
                  ? { parentSkillTemplateOid: parentSkillTemplates.in }
                  : undefined!,
                createdByActors ? { createdByTenantActorOid: createdByActors.in } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillInclude
          })
      )
    );
  }

  async getSkillById(
    d: CargoTenantEnvironment & {
      skillId: string;
    }
  ) {
    return await this.getSkillRecord(d);
  }

  async updateSkill(
    d: CargoTenantEnvironment & {
      skill: SkillRecord;
      actorId?: string;
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
    }
  ) {
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
        tenant: d.tenant,
        environment: d.environment,
        entity: { id: d.skill.id, type: 'skill' },
        imageFileId: d.input.imageFileId,
        clearedImage: { type: 'default' },
        actorId: d.actorId,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions
      });
    }

    let store = d.input.name
      ? await storeService.updateStore({
          environment: d.environment,
          tenant: d.tenant,
          store: d.skill.store,
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
      tenant: d.tenant,
      environment: d.environment,
      skillId: d.skill.id
    }).then(skill => ({ ...skill, store }) satisfies SkillRecord);
  }

  async archiveSkill(d: CargoTenantEnvironment & { skill: SkillRecord }) {
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

  async upsertSkillActor(
    d: CargoTenantEnvironment & {
      skill: SkillRecord;
      actorId: string;
      permissions: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ) {
    let actor = await actorService.getActorById({
      tenant: d.tenant,
      actorId: d.actorId
    });

    let participant = await storeAccessService.ensureActorStorePermissions({
      store: d.skill.store,
      actor,
      permissions: d.permissions,
      overridePermissions: d.overridePermissions
    });
    if (!participant) {
      throw new ServiceError(notFoundError('store.participant'));
    }

    await skillParticipantService.syncSkillParticipantsFromStore({
      skill: d.skill
    });

    return {
      skillId: d.skill.id,
      storeId: d.skill.store.id,
      actorId: actor.id,
      storeParticipantId: participant.id,
      permissions: participant.permissions
    };
  }

  async markSkillUse(
    d: CargoTenantEnvironment & {
      skill: SkillRecord;
      actorId: string;
    }
  ) {
    let actor = await actorService.getActorById({
      tenant: d.tenant,
      actorId: d.actorId
    });

    await skillParticipantService.syncSkillParticipantsFromStore({
      skill: d.skill
    });

    return await skillParticipantService.ensureSkillParticipantRoles({
      skill: d.skill,
      actor,
      roles: ['user']
    });
  }
}

export let skillService = Service.create(
  'cargoSkillService',
  () => new SkillServiceImpl()
).build();
