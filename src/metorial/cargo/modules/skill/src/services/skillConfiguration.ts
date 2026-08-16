import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillConfigurations
} from '@metorial/cargo-list-utils';
import type { Instance, Prisma, Project } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { enqueueSkillConfigurationLifecycle } from '../queues/lifecycle';

let skillConfigurationInclude = {} satisfies Prisma.SkillConfigurationInclude;

export type SkillConfigurationRecord = Prisma.SkillConfigurationGetPayload<{
  include: typeof skillConfigurationInclude;
}>;

type SkillConfigurationInput = {
  allowScripts?: boolean;
  allowedFileExtensions?: string[] | null;
  allowNonStandardDirectories?: boolean;
};

class SkillConfigurationServiceImpl {
  private normalizeAllowedFileExtensions(allowedFileExtensions?: string[] | null) {
    if (allowedFileExtensions === undefined) return undefined;
    if (!allowedFileExtensions?.length) return [];

    let normalized = [
      ...new Set(
        allowedFileExtensions
          .map(extension => extension.trim().toLowerCase())
          .filter(Boolean)
          .map(extension => (extension.startsWith('.') ? extension : `.${extension}`))
      )
    ];

    if (!normalized.length) return [];

    if (!normalized.includes('.md')) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill configuration allowed file extensions must include .md'
        })
      );
    }

    return normalized;
  }

  private getUpdateData(input: SkillConfigurationInput) {
    let allowedFileExtensions = this.normalizeAllowedFileExtensions(
      input.allowedFileExtensions
    );

    return {
      allowScripts: input.allowScripts,
      allowedFileExtensions,
      allowNonStandardDirectories: input.allowNonStandardDirectories
    };
  }

  private hasUpdate(input: SkillConfigurationInput) {
    return (
      input.allowScripts !== undefined ||
      input.allowedFileExtensions !== undefined ||
      input.allowNonStandardDirectories !== undefined
    );
  }

  private async getSkillConfigurationRecord(d: {
    project: Project;
    instance: Instance;
    skillConfigurationId: string;
  }) {
    return await withTransaction(
      async db => {
        let skillConfiguration = await db.skillConfiguration.findFirst({
          where: {
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
            isDefault: d.skillConfigurationId === 'default' ? true : undefined,
            id: d.skillConfigurationId === 'default' ? undefined : d.skillConfigurationId
          },
          include: skillConfigurationInclude
        });

        if (!skillConfiguration) {
          throw new ServiceError(notFoundError('skill.configuration', d.skillConfigurationId));
        }

        return skillConfiguration;
      },
      { ifExists: true }
    );
  }

  async createSkillConfiguration(d: {
    project: Project;
    instance: Instance;
    input: SkillConfigurationInput & {
      isInternal?: boolean;
    };
  }) {
    let data = this.getUpdateData(d.input);

    return await db.skillConfiguration.create({
      data: {
        ...getId('skillConfiguration'),
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
        isInternal: d.input.isInternal ?? false,
        allowScripts: data.allowScripts ?? true,
        allowedFileExtensions: data.allowedFileExtensions ?? [],
        allowNonStandardDirectories: data.allowNonStandardDirectories ?? true
      },
      include: skillConfigurationInclude
    });
  }

  async listSkillConfigurations(d: {
    project: Project;
    instance: Instance;
    ids?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let skillConfigurations = await resolveSkillConfigurations(d, d.ids);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillConfiguration.findMany({
            ...opts,
            where: {
              projectOid: d.project.oid,
              instanceOid: d.instance.oid,
              deletedAt: null,
              isInternal: false,
              oid: skillConfigurations ? skillConfigurations.in : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              updatedAt: d.updatedAt ? normalizeDateFilter(d.updatedAt) : undefined
            },
            include: skillConfigurationInclude
          })
      )
    );
  }

  async getSkillConfigurationById(d: {
    project: Project;
    instance: Instance;
    skillConfigurationId: string;
  }) {
    if (d.skillConfigurationId === 'default') {
      return await this.upsertDefaultSkillConfiguration(d);
    }

    return await this.getSkillConfigurationRecord(d);
  }

  async getManySkillConfigurations(d: {
    project: Project;
    instance: Instance;
    skillConfigurationIds: string[];
  }) {
    let skillConfigurationIds = [...new Set(d.skillConfigurationIds)].filter(
      id => id !== 'default'
    );
    if (!skillConfigurationIds.length) return [];

    return await db.skillConfiguration.findMany({
      where: {
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
        id: {
          in: skillConfigurationIds
        }
      },
      include: skillConfigurationInclude
    });
  }

  async upsertDefaultSkillConfiguration(d: { project: Project; instance: Instance }) {
    return await withTransaction(async db => {
      let existing = await db.skillConfiguration.findFirst({
        where: {
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          isDefault: true
        },
        include: skillConfigurationInclude
      });

      if (existing) return existing;

      return await db.skillConfiguration.create({
        data: {
          ...getId('skillConfiguration'),
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          isDefault: true,
          allowScripts: true,
          allowedFileExtensions: [],
          allowNonStandardDirectories: true
        },
        include: skillConfigurationInclude
      });
    });
  }

  async updateSkillConfiguration(d: {
    project: Project;
    instance: Instance;
    skillConfigurationId: string;
    input: SkillConfigurationInput;
  }) {
    if (!this.hasUpdate(d.input)) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one skill configuration field must be updated'
        })
      );
    }

    let skillConfiguration =
      d.skillConfigurationId === 'default'
        ? await this.upsertDefaultSkillConfiguration(d)
        : await this.getSkillConfigurationRecord(d);

    let updatedConfiguration = await db.skillConfiguration.update({
      where: {
        id: skillConfiguration.id
      },
      data: this.getUpdateData(d.input),
      include: skillConfigurationInclude
    });

    await enqueueSkillConfigurationLifecycle({
      skillConfigurationId: updatedConfiguration.id,
      event: 'updated'
    });

    return updatedConfiguration;
  }

  async deleteSkillConfiguration(d: {
    project: Project;
    instance: Instance;
    skillConfigurationId: string;
  }) {
    let skillConfiguration = await this.getSkillConfigurationRecord(d);

    if (skillConfiguration.isDefault) {
      throw new ServiceError(
        forbiddenError({
          message: 'Default skill configuration cannot be deleted'
        })
      );
    }

    if (skillConfiguration.isInternal) {
      throw new ServiceError(
        forbiddenError({
          message: 'Internal skill configurations cannot be deleted'
        })
      );
    }

    let deletedConfiguration = await db.skillConfiguration.update({
      where: {
        id: skillConfiguration.id
      },
      data: {
        deletedAt: new Date()
      },
      include: skillConfigurationInclude
    });

    await enqueueSkillConfigurationLifecycle({
      skillConfigurationId: deletedConfiguration.id,
      event: 'archived'
    });

    return deletedConfiguration;
  }
}

export let skillConfigurationService = Service.create(
  'cargoSkillConfigurationService',
  () => new SkillConfigurationServiceImpl()
).build();
