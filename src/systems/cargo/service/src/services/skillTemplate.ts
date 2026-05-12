import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { snowflake } from '../id';
import { skillService } from './skill';
import { storeService } from './store';
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

export type SkillTemplateCreateInput = Omit<StoreTemplateCreateInput, 'id'> & {
  id: string;
  skillId?: string;
};

export type SkillTemplateUpdateInput = StoreTemplateUpdateInput;

export type SkillTemplateUpsertInput = Omit<SkillTemplateCreateInput, 'skillId'> & {
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

  private assertRequiredScope(d: StoreTemplateScope): asserts d is RequiredStoreTemplateScope {
    if (!d.tenant || !d.environment) {
      throw new ServiceError(
        badRequestError({
          message: 'tenantId and environmentId are required'
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

  private assertCreateSourceInput(d: {
    skillId?: string;
    storeId?: string;
    items?: StoreTemplateCreateInput['items'];
  }) {
    let sourceCount = [
      d.skillId !== undefined,
      d.storeId !== undefined,
      d.items !== undefined
    ].filter(Boolean).length;

    if (sourceCount !== 1) {
      throw new ServiceError(
        badRequestError({
          message:
            'Provide exactly one of skillId, storeId, or items when creating a skill template'
        })
      );
    }
  }

  private async resolveCreateStoreId(
    d: StoreTemplateScope & {
      input: SkillTemplateCreateInput;
    }
  ) {
    this.assertCreateSourceInput(d.input);

    if (!d.input.skillId) {
      return d.input.storeId;
    }

    this.assertRequiredScope(d);

    let skill = await skillService.getSkillById({
      tenant: d.tenant,
      environment: d.environment,
      skillId: d.input.skillId
    });
    let clonedStore = await storeService.cloneStore({
      tenant: d.tenant,
      environment: d.environment,
      store: skill.store,
      input: {
        name: `Skill Template Store - ${d.input.name.trim()}`,
        access: 'public_read',
        cloneType: 'duplicate'
      }
    });

    return clonedStore.id;
  }

  private async createSkillTemplateRecord(
    d: StoreTemplateScope & {
      input: SkillTemplateCreateInput & {
        systemIdentifier?: string | null;
      };
    }
  ) {
    let storeId = await this.resolveCreateStoreId(d);

    return await withTransaction(async db => {
      let storeTemplate = await storeTemplateService.createStoreTemplate({
        ...d,
        input: {
          name: d.input.name,
          storeId,
          items: d.input.items
        }
      });

      return await db.skillTemplate.create({
        data: {
          tenantOid: d.tenant?.oid,
          environmentOid: d.environment?.oid,
          oid: snowflake.nextId(),
          id: d.input.id,
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

    return await withTransaction(async db => {
      let storeTemplate = await storeTemplateService.updateStoreTemplate({
        storeTemplate: d.skillTemplate.storeTemplate,
        skipScopeCheck: true,
        input: {
          name: d.input.name,
          items: d.input.items
        }
      });

      return await db.skillTemplate.update({
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
        return await withTransaction(async db => {
          let existing = await db.skillTemplate.findUnique({
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
