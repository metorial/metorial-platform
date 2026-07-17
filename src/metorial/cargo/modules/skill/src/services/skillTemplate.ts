import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { snowflake } from '@metorial/cargo-config/id';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillTemplates,
  resolveStoreTemplates
} from '@metorial/cargo-list-utils';
import { resolveInstanceResourceScope } from '@metorial/cargo-module-file';
import type {
  RequiredStoreTemplateScope,
  StoreTemplateCreateInput,
  StoreTemplateScope,
  StoreTemplateUpdateInput
} from '@metorial/cargo-module-store';
import { storeService, storeTemplateService } from '@metorial/cargo-module-store';
import type { Prisma } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { skillService } from './skill';

let skillTemplateSummaryInclude = {
  storeTemplate: {
    include: {
      resourceTenant: {
        select: {
          id: true
        }
      },
      resourceGroup: {
        select: {
          id: true
        }
      },
      sourceStore: {
        select: {
          id: true
        }
      },
      backingStores: {
        select: {
          resourceTenantOid: true,
          resourceGroupOid: true,
          store: {
            select: {
              id: true
            }
          }
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
      resourceTenant: {
        select: {
          id: true
        }
      },
      resourceGroup: {
        select: {
          id: true
        }
      },
      sourceStore: {
        select: {
          id: true
        }
      },
      backingStores: {
        select: {
          resourceTenantOid: true,
          resourceGroupOid: true,
          store: {
            select: {
              id: true
            }
          }
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

export type SkillTemplateWithScopedStoreId<T> = T & {
  storeTemplate: T extends { storeTemplate: infer S } ? S & { storeId?: string } : never;
};

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
    resourceTenant: { oid: bigint };
    resourceGroup: { oid: bigint };
  }): Prisma.StoreTemplateWhereInput {
    return {
      OR: [
        {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid
        },
        {
          resourceTenantOid: null,
          resourceGroupOid: null
        }
      ]
    };
  }

  private assertMatchingScope(d: {
    skillTemplate: SkillTemplateRecord;
    resourceTenant: { id: string };
    resourceGroup: { id: string };
  }) {
    if (
      d.skillTemplate.storeTemplate!.resourceTenant?.id !== d.resourceTenant!.id ||
      d.skillTemplate.storeTemplate!.resourceGroup?.id !== d.resourceGroup.id
    ) {
      throw new ServiceError(
        badRequestError({
          message:
            'Skill template updates and deletes are only allowed within the matching resourceTenant and resourceGroup'
        })
      );
    }
  }

  private assertRequiredScope(d: StoreTemplateScope): asserts d is RequiredStoreTemplateScope {
    if (!d.resourceTenant || !d.resourceGroup) {
      throw new ServiceError(
        badRequestError({
          message: 'resourceTenantId and resourceGroupId are required'
        })
      );
    }
  }

  private async getSkillTemplateRecord(d: {
    skillTemplateId: string;
    resourceTenant?: { oid: bigint; id: string };
    resourceGroup?: { oid: bigint; id: string };
  }) {
    let skillTemplate = await db.skillTemplate.findFirst({
      where: {
        id: d.skillTemplateId,
        storeTemplate:
          d.resourceTenant && d.resourceGroup
            ? {
                is: this.getReadableStoreTemplateScopeWhere({
                  resourceTenant: d.resourceTenant!,
                  resourceGroup: d.resourceGroup
                })
              }
            : undefined
      },
      include: skillTemplateInclude
    });

    if (!skillTemplate) {
      throw new ServiceError(notFoundError('skill.template', d.skillTemplateId));
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

  private withScopedStoreId<T extends SkillTemplateSummaryRecord | SkillTemplateRecord>(
    skillTemplate: T,
    scope?: RequiredStoreTemplateScope
  ): SkillTemplateWithScopedStoreId<T> {
    if (skillTemplate.storeTemplate!.sourceStore?.id) {
      return {
        ...skillTemplate,
        storeTemplate: {
          ...skillTemplate.storeTemplate,
          storeId: skillTemplate.storeTemplate!.sourceStore.id
        }
      } as SkillTemplateWithScopedStoreId<T>;
    }

    if (!scope) return skillTemplate as SkillTemplateWithScopedStoreId<T>;

    let backing = skillTemplate.storeTemplate!.backingStores.find(
      backing =>
        backing.resourceTenantOid === scope.resourceTenant.oid &&
        backing.resourceGroupOid === scope.resourceGroup.oid
    );

    return {
      ...skillTemplate,
      storeTemplate: {
        ...skillTemplate.storeTemplate,
        storeId: backing?.store!.id
      }
    } as SkillTemplateWithScopedStoreId<T>;
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
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      skillId: d.input.skillId
    });
    let clonedStore = await storeService.cloneStore({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      store: skill.store!,
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
    let ownerScope =
      d.resourceTenant && d.resourceGroup
        ? await resolveInstanceResourceScope({
            resourceTenant: d.resourceTenant!,
            resourceGroup: d.resourceGroup
          })
        : {};

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
          resourceTenantOid: d.resourceTenant?.oid,
          resourceGroupOid: d.resourceGroup?.oid,
          oid: snowflake.nextId(),
          id: d.input.id,
          owner: d.resourceTenant ? 'tenant' : 'system',
          slug: d.input.systemIdentifier ?? d.input.id,
          name: d.input.name,
          storeTemplateId: storeTemplate.id,
          ...ownerScope,
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
      d.skillTemplate.storeTemplate!.sourceStore?.id !== d.input.storeId
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot change storeId when upserting an existing skill template'
        })
      );
    }

    return await withTransaction(async db => {
      let storeTemplate = await storeTemplateService.updateStoreTemplate({
        storeTemplate: d.skillTemplate.storeTemplate!,
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

  async listSkillTemplates(
    d: RequiredStoreTemplateScope & {
      ids?: string[];
      storeTemplateIds?: string[];
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
    }
  ) {
    let skillTemplates = await resolveSkillTemplates(d, d.ids);
    let storeTemplates = await resolveStoreTemplates(d, d.storeTemplateIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        (
          await db.skillTemplate.findMany({
            ...opts,
            where: {
              oid: skillTemplates ? skillTemplates.in : undefined,
              storeTemplateOid: storeTemplates ? storeTemplates.in : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              updatedAt: d.updatedAt ? normalizeDateFilter(d.updatedAt) : undefined,
              storeTemplate: {
                is: this.getReadableStoreTemplateScopeWhere(d)
              }
            },
            include: skillTemplateSummaryInclude
          })
        ).map(skillTemplate => this.withScopedStoreId(skillTemplate, d))
      )
    );
  }

  async getSkillTemplateById(
    d: RequiredStoreTemplateScope & {
      skillTemplateId: string;
    }
  ) {
    return this.withScopedStoreId(await this.getSkillTemplateRecord(d), d);
  }

  async getManySkillTemplatesByIds(
    d: RequiredStoreTemplateScope & {
      skillTemplateIds: string[];
    }
  ) {
    if (d.skillTemplateIds.length === 0) return [];

    return (
      await db.skillTemplate.findMany({
        where: {
          id: { in: d.skillTemplateIds },
          storeTemplate: {
            is: this.getReadableStoreTemplateScopeWhere(d)
          }
        },
        include: skillTemplateSummaryInclude
      })
    ).map(skillTemplate => this.withScopedStoreId(skillTemplate, d));
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
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      skillTemplateId: d.skillTemplateId
    });

    this.assertMatchingScope({
      skillTemplate,
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup
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
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup
    });

    await storeTemplateService.deleteStoreTemplate({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      storeTemplateId: skillTemplate.storeTemplate!.id
    });

    return skillTemplate;
  }
}

export let skillTemplateService = Service.create(
  'cargoSkillTemplateService',
  () => new SkillTemplateServiceImpl()
).build();
