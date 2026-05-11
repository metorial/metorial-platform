import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import type {
  RequiredStoreTemplateScope,
  StoreTemplateCreateInput,
  StoreTemplateScope,
  StoreTemplateUpdateInput
} from './storeTemplate';
import { storeTemplateService } from './storeTemplate';

let skillTemplateSummaryInclude = {
  storeTemplate: {
    include: {
      tenant: {
        select: {
          id: true
        }
      },
      environment: {
        select: {
          id: true
        }
      },
      sourceStore: {
        select: {
          id: true
        }
      },
      items: {
        select: {
          id: true
        }
      }
    }
  }
} satisfies Prisma.SkillTemplateInclude;

let skillTemplateInclude = {
  storeTemplate: {
    include: {
      tenant: {
        select: {
          id: true
        }
      },
      environment: {
        select: {
          id: true
        }
      },
      sourceStore: {
        select: {
          id: true
        }
      },
      items: {
        orderBy: [
          {
            path: 'asc'
          },
          {
            id: 'asc'
          }
        ]
      }
    }
  }
} satisfies Prisma.SkillTemplateInclude;

export type SkillTemplateSummaryRecord = Prisma.SkillTemplateGetPayload<{
  include: typeof skillTemplateSummaryInclude;
}>;

export type SkillTemplateRecord = Prisma.SkillTemplateGetPayload<{
  include: typeof skillTemplateInclude;
}>;

export type SkillTemplateCreateInput = StoreTemplateCreateInput & {
  skillTemplateId?: string;
};

export type SkillTemplateUpdateInput = StoreTemplateUpdateInput;

export type SkillTemplateUpsertInput = SkillTemplateCreateInput & {
  systemIdentifier: string;
};

let isSystemIdentifierUniqueConstraintError = (error: any) => {
  if (error?.code !== 'P2002') return false;

  let target = error?.meta?.target;
  if (Array.isArray(target)) return target.includes('systemIdentifier');
  if (typeof target === 'string') return target.includes('systemIdentifier');

  return `${error?.message ?? ''}`.includes('systemIdentifier');
};

class SkillTemplateServiceImpl {
  private getReadableStoreTemplateScopeWhere(d: {
    tenant: { oid: bigint };
    environment: { oid: bigint };
  }): Prisma.StoreTemplateWhereInput {
    return {
      OR: [
        {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        {
          tenantOid: null,
          environmentOid: null
        }
      ]
    };
  }

  private assertMatchingScope(d: {
    skillTemplate: SkillTemplateRecord;
    tenant: { id: string };
    environment: { id: string };
  }) {
    if (
      d.skillTemplate.storeTemplate.tenant?.id !== d.tenant.id ||
      d.skillTemplate.storeTemplate.environment?.id !== d.environment.id
    ) {
      throw new ServiceError(
        badRequestError({
          message:
            'Skill template updates and deletes are only allowed within the matching tenant and environment'
        })
      );
    }
  }

  private async getSkillTemplateRecord(d: {
    skillTemplateId: string;
    tenant?: { oid: bigint; id: string };
    environment?: { oid: bigint; id: string };
  }) {
    let skillTemplate = await db.skillTemplate.findFirst({
      where: {
        id: d.skillTemplateId,
        ...(d.tenant && d.environment
          ? {
              storeTemplate: {
                is: this.getReadableStoreTemplateScopeWhere({
                  tenant: d.tenant,
                  environment: d.environment
                })
              }
            }
          : {})
      },
      include: skillTemplateInclude
    });

    if (!skillTemplate) {
      throw new ServiceError(notFoundError('skillTemplate', d.skillTemplateId));
    }

    return skillTemplate;
  }

  private normalizeSystemIdentifier(d: { systemIdentifier: string }) {
    let systemIdentifier = d.systemIdentifier.trim();

    if (!systemIdentifier.length) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill template systemIdentifier cannot be empty'
        })
      );
    }

    return systemIdentifier;
  }

  private async createSkillTemplateRecord(
    d: StoreTemplateScope & {
      input: SkillTemplateCreateInput & {
        systemIdentifier?: string | null;
      };
    }
  ) {
    return await withTransaction(async tx => {
      let storeTemplate = await storeTemplateService.createStoreTemplate({
        ...d,
        input: {
          id: d.input.id,
          name: d.input.name,
          storeId: d.input.storeId,
          items: d.input.items
        }
      });

      let skillTemplateIds = d.input.skillTemplateId
        ? { oid: getId('skillTemplate').oid, id: d.input.skillTemplateId }
        : getId('skillTemplate');

      return await tx.skillTemplate.create({
        data: {
          oid: skillTemplateIds.oid,
          id: skillTemplateIds.id,
          systemIdentifier: d.input.systemIdentifier ?? null,
          storeTemplateOid: storeTemplate.oid
        },
        include: skillTemplateInclude
      });
    });
  }

  private async updateSkillTemplateRecord(d: {
    skillTemplate: SkillTemplateRecord;
    input: SkillTemplateUpdateInput & {
      systemIdentifier?: string;
      storeId?: string;
    };
  }) {
    if (
      d.input.storeId !== undefined &&
      d.skillTemplate.storeTemplate.sourceStore?.id !== d.input.storeId
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot change storeId when upserting an existing skill template'
        })
      );
    }

    return await withTransaction(async tx => {
      let storeTemplate = await storeTemplateService.updateStoreTemplate({
        storeTemplate: d.skillTemplate.storeTemplate,
        skipScopeCheck: true,
        input: {
          name: d.input.name,
          items: d.input.items
        }
      });

      return await tx.skillTemplate.update({
        where: {
          oid: d.skillTemplate.oid
        },
        data: {
          systemIdentifier: d.input.systemIdentifier,
          storeTemplateOid: storeTemplate.oid
        },
        include: skillTemplateInclude
      });
    });
  }

  async listSkillTemplates(d: RequiredStoreTemplateScope) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillTemplate.findMany({
            ...opts,
            where: {
              storeTemplate: {
                is: this.getReadableStoreTemplateScopeWhere(d)
              }
            },
            include: skillTemplateSummaryInclude
          })
      )
    );
  }

  async getSkillTemplateById(
    d: RequiredStoreTemplateScope & {
      skillTemplateId: string;
    }
  ) {
    return await this.getSkillTemplateRecord(d);
  }

  async createSkillTemplate(
    d: StoreTemplateScope & {
      input: SkillTemplateCreateInput;
    }
  ) {
    return await this.createSkillTemplateRecord({
      ...d,
      input: d.input
    });
  }

  async upsertSkillTemplate(d: { input: SkillTemplateUpsertInput }) {
    let systemIdentifier = this.normalizeSystemIdentifier({
      systemIdentifier: d.input.systemIdentifier
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await withTransaction(async tx => {
          let existing = await tx.skillTemplate.findUnique({
            where: {
              systemIdentifier
            },
            include: skillTemplateInclude
          });

          if (existing) {
            return await this.updateSkillTemplateRecord({
              skillTemplate: existing,
              input: {
                name: d.input.name,
                items: d.input.items,
                storeId: d.input.storeId,
                systemIdentifier
              }
            });
          }

          return await this.createSkillTemplateRecord({
            ...d,
            input: {
              ...d.input,
              systemIdentifier
            }
          });
        });
      } catch (error) {
        if (attempt === 0 && isSystemIdentifierUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('Unreachable');
  }

  async updateSkillTemplate(
    d: RequiredStoreTemplateScope & {
      skillTemplateId: string;
      input: SkillTemplateUpdateInput;
    }
  ) {
    let skillTemplate = await this.getSkillTemplateById({
      tenant: d.tenant,
      environment: d.environment,
      skillTemplateId: d.skillTemplateId
    });

    this.assertMatchingScope({
      skillTemplate,
      tenant: d.tenant,
      environment: d.environment
    });

    return await this.updateSkillTemplateRecord({
      skillTemplate,
      input: d.input
    });
  }

  async deleteSkillTemplate(
    d: RequiredStoreTemplateScope & {
      skillTemplateId: string;
    }
  ) {
    let skillTemplate = await this.getSkillTemplateById(d);

    this.assertMatchingScope({
      skillTemplate,
      tenant: d.tenant,
      environment: d.environment
    });

    await storeTemplateService.deleteStoreTemplate({
      tenant: d.tenant,
      environment: d.environment,
      storeTemplateId: skillTemplate.storeTemplate.id
    });

    return skillTemplate;
  }
}

export let skillTemplateService = Service.create(
  'cargoSkillTemplateService',
  () => new SkillTemplateServiceImpl()
).build();
