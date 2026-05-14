import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, StoreParticipantPermissions } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { env } from '../env';
import { snowflake } from '../id';
import { actorService } from './actor';
import type { CargoTenantEnvironment } from './filePurpose';
import { fileLinkService } from './fileLink';
import { fileReferenceService } from './fileReference';
import { skillParticipantService } from './skillParticipant';
import type { SkillTemplateRecord } from './skillTemplate';
import { storeService } from './store';
import { storeAccessService } from './storeAccess';

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

export type EntityImage =
  | {
      type: 'file';
      fileId: string;
      fileLinkId: string;
      fileReferenceId: string;
      fileUrl: string;
      url?: string;
    }
  | { type: 'enterprise_file'; fileId: string }
  | { type: 'url'; url: string }
  | { type: 'default' };

export type SkillRecord = Prisma.SkillGetPayload<{
  include: typeof skillInclude;
}>;

class SkillServiceImpl {
  private getFileLinkUrl(d: { fileId: string; key: string }) {
    if (!env.service.DOWNLOAD_PUBLIC_URL) return '';

    return `${env.service.DOWNLOAD_PUBLIC_URL}/files/${d.fileId}/${d.key}`;
  }

  private async getSkillRecord(d: CargoTenantEnvironment & { skillId: string }) {
    return await withTransaction(
      async db => {
        let skill = await db.skill.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            id: d.skillId
          },
          include: skillInclude
        });

        if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

        return skill;
      },
      { ifExists: true }
    );
  }

  private async createImageEntityImage(
    d: CargoTenantEnvironment & {
      skill: Pick<SkillRecord, 'id'>;
      fileId: string;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ): Promise<EntityImage> {
    let file = await db.file.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        id: d.fileId,
        status: 'active'
      },
      include: {
        purpose: true
      }
    });
    if (!file) throw new ServiceError(notFoundError('file', d.fileId));
    if (!file.purpose.canHaveLinks) {
      throw new ServiceError(
        forbiddenError({
          message: 'File purpose does not allow creating links'
        })
      );
    }

    let link = await fileLinkService.createFileLink({
      tenant: d.tenant,
      environment: d.environment,
      file,
      input: {
        actorId: d.actorId
      }
    });
    let ref = await fileReferenceService.upsertFileReference({
      tenant: d.tenant,
      environment: d.environment,
      fileLink: link,
      input: {
        entityType: 'skill',
        entityId: d.skill.id
      }
    });

    return {
      type: 'file',
      fileId: file.id,
      fileLinkId: link.id,
      fileReferenceId: ref.id,
      fileUrl: this.getFileLinkUrl({ fileId: file.id, key: link.key })
    };
  }

  private async resolveImageEntityImage<ClearImage extends EntityImage | null>(
    d: CargoTenantEnvironment & {
      skill: Pick<SkillRecord, 'id'>;
      imageFileId: string | null;
      clearedImage: ClearImage;
      actorId?: string;
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ): Promise<EntityImage | ClearImage> {
    if (d.imageFileId === null) return d.clearedImage;

    return await this.createImageEntityImage({
      tenant: d.tenant,
      environment: d.environment,
      skill: d.skill,
      fileId: d.imageFileId,
      actorId: d.actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions
    });
  }

  private async cleanupImageEntityImage(d: { image: EntityImage | null | undefined }) {
    if (d.image?.type !== 'file' || !d.image.fileReferenceId || !d.image.fileLinkId) return;

    await fileReferenceService.deleteFileReferenceByIdAndCleanup({
      fileReferenceId: d.image.fileReferenceId
    });
  }

  async createSkill(
    d: CargoTenantEnvironment & {
      parentSkill?: SkillRecord;
      parentSkillTemplate?: SkillTemplateRecord;
      parentSkillCloneType?: 'fork' | 'duplicate';
      input: {
        id: string;
        actorId?: string;
        name: string;
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

    return await withTransaction(async db => {
      let store = d.parentSkillTemplate
        ? await storeService.createStoreFromTemplate({
            tenant: d.tenant,
            environment: d.environment,
            input: {
              templateId: d.parentSkillTemplate.storeTemplate.id,
              name: d.input.name,
              actor,
              access: 'public_read'
            }
          })
        : await storeService.createStore({
            tenant: d.tenant,
            environment: d.environment,
            input: {
              name: d.input.name,
              actor,
              access: 'public_read',
              parentStore: d.parentSkill?.store,
              cloneType: !d.parentSkill
                ? undefined
                : d.parentSkillCloneType === 'duplicate'
                  ? 'duplicate'
                  : 'sync_until_change'
            }
          });

      let skill = await db.skill.create({
        data: {
          oid: snowflake.nextId(),
          id: d.input.id,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          storeOid: store.oid,
          parentSkillOid: d.parentSkill?.oid,
          parentSkillTemplateOid: d.parentSkillTemplate?.oid,
          createdByTenantActorOid: actor?.oid
        },
        include: skillInclude
      });

      if (d.input.imageFileId !== undefined) {
        let image = await this.resolveImageEntityImage({
          tenant: d.tenant,
          environment: d.environment,
          skill,
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

      return skill;
    });
  }

  async listSkills(d: CargoTenantEnvironment) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skill.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid
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
        imageFileId?: string | null;
        image?: EntityImage | null;
      };
    }
  ) {
    if (
      d.input.name === undefined &&
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
      nextImage = await this.resolveImageEntityImage({
        tenant: d.tenant,
        environment: d.environment,
        skill: d.skill,
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

    if (d.input.imageFileId !== undefined || d.input.image !== undefined) {
      await db.skill.update({
        where: {
          id: d.skill.id
        },
        data: {
          image: nextImage as any
        }
      });

      await this.cleanupImageEntityImage({
        image:
          d.skill.image && canonicalize(d.skill.image) !== canonicalize(nextImage)
            ? (d.skill.image as EntityImage)
            : undefined
      });
    }

    return await this.getSkillRecord({
      tenant: d.tenant,
      environment: d.environment,
      skillId: d.skill.id
    }).then(skill => ({ ...skill, store }) satisfies SkillRecord);
  }

  async deleteSkill(d: CargoTenantEnvironment & { skill: SkillRecord }) {
    await storeService.deleteStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.skill.store,
      allowLinkedSkillDelete: true,
      allowLinkedStoreTemplateDelete: true
    });

    return d.skill;
  }

  async upsertSkillActor(
    d: CargoTenantEnvironment & {
      skill: SkillRecord;
      actorId: string;
      permissions: StoreParticipantPermissions[];
    }
  ) {
    let actor = await actorService.getActorById({
      tenant: d.tenant,
      actorId: d.actorId
    });

    let participant = await storeAccessService.ensureActorStorePermissions({
      store: d.skill.store,
      actor,
      permissions: d.permissions
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
