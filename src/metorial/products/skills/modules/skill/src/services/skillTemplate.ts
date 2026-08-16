import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillTemplates,
  resolveStoreTemplates
} from '@metorial/cargo-list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial/skills-search';
import type {
  RequiredStoreTemplateScope,
  StoreTemplateCreateInput,
  StoreTemplateScope,
  StoreTemplateUpdateInput
} from '@metorial/cargo-module-store';
import { storeService, storeTemplateService } from '@metorial/cargo-module-store';
import type { Prisma } from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import {
  accessTagService,
  type AnyAccessTagSelector,
  consumerSkillReadRoles
} from '@metorial/module-access';
import { getProjectTenantIdentifier } from '../internal/scope';
import { enqueueSkillTemplateLifecycle } from '../queues/lifecycle/skillTemplate';
import { skillResourceService } from './resource';
import { skillService } from './skill';

let skillTemplateSummaryInclude = {
  storeTemplate: {
    include: {
      sourceStore: {
        select: {
          id: true
        }
      },
      backingStores: {
        select: {
          projectOid: true,
          instanceOid: true,
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
      sourceStore: {
        select: {
          id: true
        }
      },
      backingStores: {
        select: {
          projectOid: true,
          instanceOid: true,
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

type SkillTemplateScope = StoreTemplateScope;

export type SkillTemplateWithScopedStoreId<T> = T & {
  storeTemplate: T extends { storeTemplate: infer S } ? S & { storeId?: string } : never;
};

export type SkillTemplateCreateInput = Omit<StoreTemplateCreateInput, 'id'> & {
  id: string;
  skillId?: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export type SkillTemplateUpdateInput = StoreTemplateUpdateInput & {
  description?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export type SkillTemplateUpsertInput = Omit<SkillTemplateCreateInput, 'skillId'> & {
  systemIdentifier: string;
};

let getPlainSkillTemplateItems = (): NonNullable<StoreTemplateCreateInput['items']> => [
  {
    path: '/SKILL.md',
    type: 'document',
    content:
      '# Skill Template\n\nSet the scene, define the problem and task.\n\n## Prerequisites\n\n1. ...\n\n## Instructions\n\n1. ...\n\n## References\n',
    encoding: 'utf-8'
  },
  { path: '/references/', type: 'directory' },
  { path: '/assets/', type: 'directory' }
];

let isSystemIdentifierUniqueConstraintError = (error: any) => {
  if (error?.code !== 'P2002') return false;

  let target = error?.meta?.target;
  if (Array.isArray(target)) return target.includes('systemIdentifier');
  if (typeof target === 'string') return target.includes('systemIdentifier');

  return `${error?.message ?? ''}`.includes('systemIdentifier');
};

class SkillTemplateServiceImpl {
  private async ensurePlainSkillTemplate() {
    return await this.upsertSkillTemplate({
      input: {
        id: await ID.generateId('skillTemplate'),
        systemIdentifier: 'plain',
        name: 'Plain',
        items: getPlainSkillTemplateItems()
      }
    });
  }
  private getReadableStoreTemplateScopeWhere(d: {
    project: { oid: bigint };
    instance: { oid: bigint };
  }): Prisma.StoreTemplateWhereInput {
    return {
      OR: [
        {
          projectOid: d.project.oid,
          instanceOid: d.instance.oid
        },
        {
          projectOid: null,
          instanceOid: null
        }
      ]
    };
  }

  private assertMatchingScope(d: {
    skillTemplate: SkillTemplateRecord;
    project: { oid: bigint };
    instance: { oid: bigint };
  }) {
    if (
      d.skillTemplate.storeTemplate!.projectOid !== d.project.oid ||
      d.skillTemplate.storeTemplate!.instanceOid !== d.instance.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message:
            'Skill template updates and deletes are only allowed within the matching project and instance'
        })
      );
    }
  }

  private assertRequiredScope(d: StoreTemplateScope): asserts d is RequiredStoreTemplateScope {
    if (!d.project || !d.instance) {
      throw new ServiceError(
        badRequestError({
          message: 'projectId and instanceId are required'
        })
      );
    }
  }

  private async getSkillTemplateRecord(d: {
    skillTemplateId: string;
    project?: { oid: bigint };
    instance?: { oid: bigint };
    accessTags?: AnyAccessTagSelector;
  }) {
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerSkillReadRoles]
    });
    let skillTemplate = await db.skillTemplate.findFirst({
      where: {
        id: d.skillTemplateId,
        status: d.accessTags ? 'active' : undefined,
        accessTagEntities: accessTagFilter,
        storeTemplate:
          d.project && d.instance
            ? {
                is: this.getReadableStoreTemplateScopeWhere({
                  project: d.project,
                  instance: d.instance
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
        backing.projectOid === scope.project.oid && backing.instanceOid === scope.instance.oid
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

    if (sourceCount > 1) {
      throw new ServiceError(
        badRequestError({
          message:
            'Provide exactly one of skillId, storeId, or items when creating a skill template'
        })
      );
    }
  }

  private async resolveCreateStoreId(
    d: SkillTemplateScope & {
      input: SkillTemplateCreateInput;
    }
  ) {
    this.assertCreateSourceInput(d.input);

    if (d.input.storeId || d.input.items !== undefined) {
      return d.input.storeId;
    }

    this.assertRequiredScope(d);

    if (!d.input.skillId) {
      let plainTemplate = await this.ensurePlainSkillTemplate();
      let store = await storeService.createStoreFromTemplate({
        project: d.project,
        instance: d.instance,
        authorization: { type: 'privileged' },
        input: {
          templateId: plainTemplate.storeTemplate!.id,
          name: `Skill Template Store - ${d.input.name.trim()}`,
          access: 'public_read'
        }
      });

      return store.id;
    }

    let skill = await skillService.getSkillById({
      project: d.project,
      instance: d.instance,
      skillId: d.input.skillId
    });
    let clonedStore = await storeService.cloneStore({
      project: d.project,
      instance: d.instance,
      authorization: { type: 'privileged' },
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
    d: SkillTemplateScope & {
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

      let template = await db.skillTemplate.create({
        data: {
          projectOid: d.project?.oid ?? null,
          instanceOid: d.instance?.oid ?? null,
          id: d.input.id,
          owner: d.project ? 'tenant' : 'system',
          slug:
            d.input.systemIdentifier ??
            `${slugify(d.input.name)}-${generatePlainId(5).toLowerCase()}`,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata as any,
          storeId,
          storeTemplateId: storeTemplate.id,
          organizationOid: d.instance?.organizationOid,
          systemIdentifier: d.input.systemIdentifier ?? null,
          storeTemplateOid: storeTemplate.oid
        },
        include: skillTemplateInclude
      });
      await enqueueSkillTemplateLifecycle({
        skillTemplateId: template.id,
        event: 'created'
      });
      return await db.skillTemplate.findUniqueOrThrow({
        where: { id: template.id },
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

      let template = await db.skillTemplate.update({
        where: {
          oid: d.skillTemplate.oid
        },
        data: {
          systemIdentifier: d.input.systemIdentifier,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata as any,
          storeTemplateOid: storeTemplate.oid
        },
        include: skillTemplateInclude
      });
      await enqueueSkillTemplateLifecycle({
        skillTemplateId: template.id,
        event: 'updated'
      });
      return template;
    });
  }

  async listSkillTemplates(
    d: RequiredStoreTemplateScope & {
      ids?: string[];
      storeTemplateIds?: string[];
      createdAt?: DateFilter;
      updatedAt?: DateFilter;
      search?: string;
      statuses?: Array<'active' | 'archived' | 'deleted'>;
      owners?: Array<'system' | 'tenant'>;
      providerIds?: string[];
      integrationIds?: string[];
      accessTags?: AnyAccessTagSelector;
    }
  ) {
    await this.ensurePlainSkillTemplate();
    let skillTemplates = await resolveSkillTemplates(d, d.ids);
    let storeTemplates = await resolveStoreTemplates(d, d.storeTemplateIds);
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerSkillReadRoles]
    });
    let delegatedResourceTemplateIds: string[] | undefined;
    if (d.providerIds?.length || d.integrationIds?.length) {
      let instance = await db.instance.findFirst({
        where: {
          oid: d.instance.oid
        }
      });
      let candidates = await db.skillTemplate.findMany({
        where: {
          status: d.accessTags
            ? 'active'
            : d.statuses?.length
              ? { in: d.statuses }
              : undefined,
          accessTagEntities: accessTagFilter,
          storeTemplate: { is: this.getReadableStoreTemplateScopeWhere(d) }
        },
        select: { id: true }
      });
      if (instance) {
        let hydrated: Awaited<
          ReturnType<typeof skillResourceService.hydrateDelegatedSkillTemplateResources>
        > = [];
        for (let offset = 0; offset < candidates.length; offset += 100) {
          hydrated.push(
            ...(await skillResourceService.hydrateDelegatedSkillTemplateResources({
              instance,
              skillTemplateIds: candidates
                .slice(offset, offset + 100)
                .map(template => template.id)
            }))
          );
        }
        delegatedResourceTemplateIds = hydrated
          .filter(resource => {
            let providerMatch =
              !d.providerIds?.length ||
              resource.items.some(
                item => item.provider && d.providerIds!.includes(item.provider.id)
              );
            let integrationMatch =
              !d.integrationIds?.length ||
              resource.items.some(
                item => item.integration && d.integrationIds!.includes(item.integration.id)
              );
            return providerMatch && integrationMatch;
          })
          .map(resource => resource.skillTemplateId);
      } else {
        delegatedResourceTemplateIds = [];
      }
    }
    let normalizedSearch = d.search?.trim() || undefined;
    let search = normalizedSearch
      ? await voyager.record.search({
          tenantId: getProjectTenantIdentifier(d.project),
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.skillTemplate.id,
          query: normalizedSearch
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        (
          await db.skillTemplate.findMany({
            ...opts,
            where: {
              oid: skillTemplates ? skillTemplates.in : undefined,
              status: d.accessTags
                ? 'active'
                : d.statuses?.length
                  ? { in: d.statuses }
                  : undefined,
              owner: d.owners?.length ? { in: d.owners } : undefined,
              storeTemplateOid: storeTemplates ? storeTemplates.in : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
              updatedAt: d.updatedAt ? normalizeDateFilter(d.updatedAt) : undefined,
              accessTagEntities: accessTagFilter,
              AND: [
                ...(search ? [{ id: { in: search.map(result => result.documentId) } }] : []),
                ...(delegatedResourceTemplateIds
                  ? [{ id: { in: delegatedResourceTemplateIds } }]
                  : [])
              ],
              storeTemplate: {
                is: this.getReadableStoreTemplateScopeWhere(d)
              }
            },
            include: skillTemplateSummaryInclude
          })
        ).map(skillTemplate =>
          this.withScopedStoreId(skillTemplate as SkillTemplateSummaryRecord, d)
        )
      )
    );
  }

  async getSkillTemplateById(
    d: RequiredStoreTemplateScope & {
      skillTemplateId: string;
      accessTags?: AnyAccessTagSelector;
    }
  ) {
    return this.withScopedStoreId(await this.getSkillTemplateRecord(d), d);
  }

  async getDefaultSkillTemplate(d: RequiredStoreTemplateScope) {
    return this.withScopedStoreId(await this.ensurePlainSkillTemplate(), d);
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
    d: SkillTemplateScope & {
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
      project: d.project,
      instance: d.instance,
      skillTemplateId: d.skillTemplateId
    });

    this.assertMatchingScope({
      skillTemplate,
      project: d.project,
      instance: d.instance
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
      project: d.project,
      instance: d.instance
    });

    return await withTransaction(async db => {
      let archived = await db.skillTemplate.update({
        where: { oid: skillTemplate.oid },
        data: { status: 'archived' },
        include: skillTemplateInclude
      });
      await enqueueSkillTemplateLifecycle({
        skillTemplateId: archived.id,
        event: 'archived'
      });

      return this.withScopedStoreId(archived, d);
    });
  }
}

export let skillTemplateService = Service.create(
  'cargoSkillTemplateService',
  () => new SkillTemplateServiceImpl()
).build();
