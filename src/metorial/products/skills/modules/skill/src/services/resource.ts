import { Service } from '@lowerdeck/service';
import { db, type Prisma } from '@metorial/db';
import {
  resourceActorPresentationInclude,
  type ResourceActorPresentationRecord
} from '@metorial/module-resource-actor';
import {
  db as subspaceDb,
  ID,
  type Prisma as SubspacePrisma,
  withTransaction as withSubspaceTransaction
} from '@metorial-subspace/db';
import { subspaceScopeService } from '@metorial-subspace/module-tenant';
import { reconcileSkillProviderLinksQueue } from '../queues/reconcileSkillProviderLinks';
import type { SkillGroupRecord } from './skillGroup';
import type { SkillGroupItemRecord } from './skillGroupItem';

let subspaceSkillItemInclude = {
  skill: true,
  integration: {
    include: {
      integration: true
    }
  },
  provider: {
    include: {
      provider: {
        include: { listing: true }
      }
    }
  }
} satisfies SubspacePrisma.SkillItemInclude;

let subspaceSkillTemplateItemInclude = {
  integration: true,
  provider: {
    include: {
      listing: true
    }
  }
} satisfies SubspacePrisma.SkillTemplateItemInclude;

type SubspaceSkillItemRecord = SubspacePrisma.SkillItemGetPayload<{
  include: typeof subspaceSkillItemInclude;
}>;

type SubspaceSkillTemplateItemRecord = SubspacePrisma.SkillTemplateItemGetPayload<{
  include: typeof subspaceSkillTemplateItemInclude;
}>;

export type SubspaceIntegrationPreview = NonNullable<
  SubspaceSkillItemRecord['integration']
>['integration'];
export type SubspaceProviderPreview = NonNullable<
  SubspaceSkillItemRecord['provider']
>['provider'];

let skillResourceInclude = {
  store: true,
  parentSkill: {
    include: {
      createdByResourceActor: {
        include: resourceActorPresentationInclude
      }
    }
  },
  parentSkillTemplate: {
    select: { id: true }
  },
  forkedFromSkillVersion: {
    include: {
      skill: {
        include: {
          createdByResourceActor: {
            include: resourceActorPresentationInclude
          }
        }
      }
    }
  },
  createdByResourceActor: {
    include: resourceActorPresentationInclude
  },
  instance: true
} satisfies Prisma.SkillInclude;

export type SkillResourceBase = Prisma.SkillGetPayload<{
  include: typeof skillResourceInclude;
}>;

export type SkillResource = SkillResourceBase & {
  localSkill: SkillResourceBase;
  hierarchy: {
    type: 'root' | 'fork' | 'duplicated';
    parentSkillId: string | null;
    creator: ResourceActorPresentationRecord | null;
    fork: {
      id: string;
      parentSkillId: string;
      creator: ResourceActorPresentationRecord | null;
      originalCreator: ResourceActorPresentationRecord | null;
      createdAt: Date;
    } | null;
    entity: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      parentSkillId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  };
  integrations: SubspaceIntegrationPreview[];
  providers: SubspaceProviderPreview[];
};

export type SkillItemResource = Omit<
  SubspaceSkillItemRecord,
  'skill' | 'integration' | 'provider'
> & {
  skillId: string;
  integration: SubspaceIntegrationPreview | null;
  provider: SubspaceProviderPreview | null;
};
export type SkillTemplateItemResource = Omit<
  SubspaceSkillTemplateItemRecord,
  'integration' | 'provider'
> & {
  type: 'integration' | 'provider';
  integration: SubspaceIntegrationPreview | null;
  provider: SubspaceProviderPreview | null;
};

export let presentSkillItemResource = (item: SubspaceSkillItemRecord): SkillItemResource => ({
  ...item,
  skillId: item.skill.id,
  integration: item.integration?.integration ?? null,
  provider: item.provider?.provider ?? null
});

export let presentSkillTemplateItemResource = (
  item: SubspaceSkillTemplateItemRecord
): SkillTemplateItemResource => ({
  ...item,
  type: item.integration ? 'integration' : 'provider',
  integration: item.integration,
  provider: item.provider
});

export type SkillGroupResource = Omit<SkillGroupRecord, 'items'> & {
  localSkillGroup: Omit<SkillGroupRecord, 'items'>;
  items: SkillGroupRecord['items'];
  skills: SkillResource[];
};

export type SkillGroupItemResource = Omit<SkillGroupItemRecord, 'skill'> & {
  skillGroupId: string;
  skill: SkillResource;
};

export type SkillTemplateResource = Prisma.SkillTemplateGetPayload<{
  include: {
    storeTemplate: true;
    instance: true;
  };
}> & {
  localSkillTemplate: Prisma.SkillTemplateGetPayload<{
    include: {
      storeTemplate: true;
      instance: true;
    };
  }>;
  items: SkillTemplateItemResource[];
};

type SkillTemplateHydrationInput = {
  id: string;
  storeTemplate?: unknown;
};

class SkillResourceServiceImpl {
  async ensureDelegatedSkill(skill: { id: string }) {
    let record = await db.skill.findUnique({
      where: { id: skill.id },
      include: {
        instance: true,
        parentSkill: { select: { id: true } },
        parentSkillTemplate: { select: { id: true } }
      }
    });
    if (!record?.instance) return;

    let { tenant, environment, solution } = await subspaceScopeService.ensureForInstance(
      record.instance
    );
    let existing = await subspaceDb.skill.findUnique({
      where: { id: record.id },
      include: { skillEntity: true }
    });
    let [parentSkill, parentTemplate] = await Promise.all([
      record.parentSkill
        ? subspaceDb.skill.findUnique({ where: { id: record.parentSkill.id } })
        : null,
      record.parentSkillTemplate
        ? subspaceDb.skillTemplate.findUnique({
            where: { id: record.parentSkillTemplate.id }
          })
        : null
    ]);

    await withSubspaceTransaction(async subspaceDb => {
      let skillEntity =
        existing?.skillEntity ??
        (await subspaceDb.skillEntity.create({
          data: {
            id: await ID.generateId('skillEntity'),
            slug: record.slug ?? record.id,
            name: record.name,
            description: record.description,
            image: (record.image ?? undefined) as any,
            tenantOid: tenant.oid,
            projectOid: tenant.projectOid,
            solutionOid: solution.oid,
            environmentOid: environment.oid,
            instanceOid: environment.instanceOid
          }
        }));

      let projected = await subspaceDb.skill.upsert({
        where: { id: record.id },
        create: {
          id: record.id,
          status: record.status,
          slug: record.slug ?? record.id,
          name: record.name,
          description: record.description,
          metadata: record.metadata as any,
          image: (record.image ?? undefined) as any,
          clientName: record.clientName?.trim() || record.name,
          clientDescription: record.clientDescription,
          clientMetadata: record.clientMetadata as any,
          license: record.license,
          compatibility: record.compatibility,
          storeId: record.storeId,
          skillEntityOid: skillEntity.oid,
          tenantOid: tenant.oid,
          projectOid: tenant.projectOid,
          solutionOid: solution.oid,
          environmentOid: environment.oid,
          instanceOid: environment.instanceOid,
          duplicatedFromSkillOid: parentSkill?.oid,
          parentTemplateOid: parentTemplate?.oid
        },
        update: {
          status: record.status,
          slug: record.slug ?? existing?.slug ?? record.id,
          name: record.name,
          description: record.description,
          metadata: record.metadata as any,
          image: (record.image ?? undefined) as any,
          clientName: record.clientName?.trim() || record.name,
          clientDescription: record.clientDescription,
          clientMetadata: record.clientMetadata as any,
          license: record.license,
          compatibility: record.compatibility,
          storeId: record.storeId,
          duplicatedFromSkillOid: parentSkill?.oid,
          parentTemplateOid: parentTemplate?.oid
        }
      });

      if (!skillEntity.ownerSkillOid) {
        await subspaceDb.skillEntity.update({
          where: { oid: skillEntity.oid },
          data: { ownerSkillOid: projected.oid }
        });
      }
    });

    await reconcileSkillProviderLinksQueue.add({ skillId: record.id });
  }

  async ensureDelegatedSkillTemplate(template: { id: string }) {
    let record = await db.skillTemplate.findUnique({
      where: { id: template.id },
      include: { instance: true, storeTemplate: true }
    });
    if (!record?.instance) return;

    let { tenant, environment, solution } = await subspaceScopeService.ensureForInstance(
      record.instance
    );
    await subspaceDb.skillTemplate.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        status: record.status,
        owner: record.owner,
        slug: record.slug,
        name: record.name,
        description: record.description,
        metadata: record.metadata as any,
        storeId: null,
        storeTemplateId: record.storeTemplateId,
        systemIdentifier: record.systemIdentifier,
        tenantOid: record.owner === 'tenant' ? tenant.oid : null,
        projectOid: record.owner === 'tenant' ? tenant.projectOid : null,
        solutionOid: record.owner === 'tenant' ? solution.oid : null,
        environmentOid: record.owner === 'tenant' ? environment.oid : null,
        instanceOid: record.owner === 'tenant' ? environment.instanceOid : null
      },
      update: {
        status: record.status,
        owner: record.owner,
        slug: record.slug,
        name: record.name,
        description: record.description,
        metadata: record.metadata as any,
        storeTemplateId: record.storeTemplateId,
        systemIdentifier: record.systemIdentifier
      }
    });
  }

  async hydrateDelegatedSkillResources(d: {
    instance: Prisma.InstanceGetPayload<{}>;
    skillIds: string[];
  }) {
    if (!d.skillIds.length) return [];
    let { tenant, environment, solution } = await subspaceScopeService.ensureForInstance(
      d.instance
    );
    let skills = await subspaceDb.skill.findMany({
      where: {
        id: { in: d.skillIds },
        tenantOid: tenant.oid,
        solutionOid: solution.oid,
        environmentOid: environment.oid
      },
      include: {
        skillIntegrations: {
          where: { status: 'active' },
          include: { integration: true }
        },
        skillProviderLinks: {
          include: {
            provider: {
              include: { listing: true }
            }
          }
        },
        skillItems: {
          where: { status: 'active' },
          include: subspaceSkillItemInclude
        }
      }
    });
    let byId = new Map(skills.map(skill => [skill.id, skill]));

    return d.skillIds.flatMap(skillId => {
      let skill = byId.get(skillId);
      if (!skill) return [];
      return [
        {
          skillId: skill.id,
          items: skill.skillItems.map(presentSkillItemResource),
          integrations: skill.skillIntegrations.map(item => item.integration),
          providers: skill.skillProviderLinks.map(link => link.provider)
        }
      ];
    });
  }

  async hydrateDelegatedSkillTemplateResources(d: {
    instance: Prisma.InstanceGetPayload<{}>;
    skillTemplateIds: string[];
  }) {
    if (!d.skillTemplateIds.length) return [];
    let { tenant, environment, solution } = await subspaceScopeService.ensureForInstance(
      d.instance
    );
    let templates = await subspaceDb.skillTemplate.findMany({
      where: {
        id: { in: d.skillTemplateIds },
        OR: [
          {
            owner: 'tenant',
            tenantOid: tenant.oid,
            solutionOid: solution.oid,
            environmentOid: environment.oid
          },
          {
            owner: 'system',
            tenantOid: null,
            environmentOid: null,
            OR: [{ solutionOid: solution.oid }, { solutionOid: null }]
          }
        ]
      },
      include: {
        skillTemplateItems: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          include: subspaceSkillTemplateItemInclude
        }
      }
    });
    let byId = new Map(templates.map(template => [template.id, template]));

    return d.skillTemplateIds.flatMap(skillTemplateId => {
      let template = byId.get(skillTemplateId);
      if (!template) return [];
      return [
        {
          skillTemplateId: template.id,
          items: template.skillTemplateItems.map(presentSkillTemplateItemResource)
        }
      ];
    });
  }

  async copyDelegatedSkillResourcesToTemplate(d: {
    skill: { id: string };
    skillTemplate: { id: string };
  }) {
    await Promise.all([
      this.ensureDelegatedSkill(d.skill),
      this.ensureDelegatedSkillTemplate(d.skillTemplate)
    ]);
    let skill = await db.skill.findUnique({
      where: { id: d.skill.id },
      include: { instance: true }
    });
    if (!skill?.instance) return;
    let [resources] = await this.hydrateDelegatedSkillResources({
      instance: skill.instance,
      skillIds: [skill.id]
    });
    if (!resources) return;
    let targetTemplate = await subspaceDb.skillTemplate.findUniqueOrThrow({
      where: { id: d.skillTemplate.id }
    });

    for (let integration of resources.integrations) {
      await subspaceDb.skillTemplateItem.create({
        data: {
          id: await ID.generateId('skillTemplateItem'),
          skillTemplateOid: targetTemplate.oid,
          integrationOid: integration.oid
        }
      });
    }
    for (let provider of resources.providers) {
      await subspaceDb.skillTemplateItem.create({
        data: {
          id: await ID.generateId('skillTemplateItem'),
          skillTemplateOid: targetTemplate.oid,
          providerOid: provider.oid
        }
      });
    }
  }

  async copyDelegatedSkillResources(d: {
    sourceSkill: { id: string };
    targetSkill: { id: string };
  }) {
    await Promise.all([
      this.ensureDelegatedSkill(d.sourceSkill),
      this.ensureDelegatedSkill(d.targetSkill)
    ]);
    let target = await db.skill.findUnique({
      where: { id: d.targetSkill.id },
      include: { instance: true }
    });
    if (!target?.instance) return;
    let [resources] = await this.hydrateDelegatedSkillResources({
      instance: target.instance,
      skillIds: [d.sourceSkill.id]
    });
    if (!resources) return;
    let targetSkill = await subspaceDb.skill.findUniqueOrThrow({
      where: { id: target.id }
    });

    for (let item of resources.items) {
      if (item.integration) {
        await withSubspaceTransaction(async subspaceDb => {
          let targetItem = await subspaceDb.skillItem.create({
            data: {
              id: await ID.generateId('skillItem'),
              status: 'active',
              type: 'integration',
              skillOid: targetSkill.oid
            }
          });
          await subspaceDb.skillIntegration.create({
            data: {
              id: await ID.generateId('skillIntegration'),
              status: 'active',
              skillOid: targetSkill.oid,
              integrationOid: item.integration!.oid,
              itemOid: targetItem.oid
            }
          });
        });
      } else if (item.provider) {
        await withSubspaceTransaction(async subspaceDb => {
          let targetItem = await subspaceDb.skillItem.create({
            data: {
              id: await ID.generateId('skillItem'),
              status: 'active',
              type: 'provider',
              skillOid: targetSkill.oid
            }
          });
          await subspaceDb.skillProvider.create({
            data: {
              id: await ID.generateId('skillProvider'),
              status: 'active',
              skillOid: targetSkill.oid,
              providerOid: item.provider!.oid,
              itemOid: targetItem.oid
            }
          });
        });
      }
    }
    await reconcileSkillProviderLinksQueue.add({ skillId: target.id });
  }

  async copyDelegatedTemplateResourcesToSkill(d: {
    skillTemplate: { id: string };
    skill: { id: string };
  }) {
    await Promise.all([
      this.ensureDelegatedSkillTemplate(d.skillTemplate),
      this.ensureDelegatedSkill(d.skill)
    ]);
    let skill = await db.skill.findUnique({
      where: { id: d.skill.id },
      include: { instance: true }
    });
    if (!skill?.instance) return;
    let [resources] = await this.hydrateDelegatedSkillTemplateResources({
      instance: skill.instance,
      skillTemplateIds: [d.skillTemplate.id]
    });
    if (!resources) return;
    let targetSkill = await subspaceDb.skill.findUniqueOrThrow({
      where: { id: skill.id }
    });

    for (let item of resources.items) {
      if (item.integration) {
        await withSubspaceTransaction(async subspaceDb => {
          let targetItem = await subspaceDb.skillItem.create({
            data: {
              id: await ID.generateId('skillItem'),
              status: 'active',
              type: 'integration',
              skillOid: targetSkill.oid
            }
          });
          await subspaceDb.skillIntegration.create({
            data: {
              id: await ID.generateId('skillIntegration'),
              status: 'active',
              skillOid: targetSkill.oid,
              integrationOid: item.integration!.oid,
              itemOid: targetItem.oid
            }
          });
        });
      } else if (item.provider) {
        await withSubspaceTransaction(async subspaceDb => {
          let targetItem = await subspaceDb.skillItem.create({
            data: {
              id: await ID.generateId('skillItem'),
              status: 'active',
              type: 'provider',
              skillOid: targetSkill.oid
            }
          });
          await subspaceDb.skillProvider.create({
            data: {
              id: await ID.generateId('skillProvider'),
              status: 'active',
              skillOid: targetSkill.oid,
              providerOid: item.provider!.oid,
              itemOid: targetItem.oid
            }
          });
        });
      }
    }
    await reconcileSkillProviderLinksQueue.add({ skillId: skill.id });
  }

  async hydrateSkills(skills: Array<{ id: string }>): Promise<SkillResource[]> {
    if (!skills.length) return [];
    let records = await db.skill.findMany({
      where: { id: { in: skills.map(skill => skill.id) } },
      include: skillResourceInclude
    });
    let byId = new Map(records.map(skill => [skill.id, skill]));
    let ordered = skills
      .map(skill => byId.get(skill.id))
      .filter((skill): skill is SkillResourceBase => !!skill);
    let entityIds = [...new Set(ordered.map(skill => skill.skillEntityId))];
    let entities = await db.skill.findMany({
      where: { id: { in: entityIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentSkill: { select: { id: true } },
        createdAt: true,
        updatedAt: true
      }
    });
    let entityById = new Map(entities.map(entity => [entity.id, entity]));
    let hydrationBySkillId = new Map<
      string,
      {
        integrations: SubspaceIntegrationPreview[];
        providers: SubspaceProviderPreview[];
      }
    >();
    for (let skill of ordered) {
      if (!skill.instance || hydrationBySkillId.has(skill.id)) continue;
      let instanceSkills = ordered.filter(item => item.instance?.id === skill.instance!.id);
      let hydrated = await this.hydrateDelegatedSkillResources({
        instance: skill.instance,
        skillIds: instanceSkills.map(item => item.id)
      });
      for (let item of hydrated) {
        hydrationBySkillId.set(item.skillId, {
          integrations: item.integrations,
          providers: item.providers
        });
      }
    }

    return ordered.map(skill => {
      let entity = entityById.get(skill.skillEntityId) ?? skill;
      let isFork = !!skill.forkedFromSkillVersion;
      let isDuplicate = !!skill.parentSkill && !isFork;
      let parent = skill.parentSkill ?? skill.forkedFromSkillVersion?.skill ?? null;

      return {
        ...skill,
        localSkill: skill,
        hierarchy: {
          type: isFork ? 'fork' : isDuplicate ? 'duplicated' : 'root',
          parentSkillId: parent?.id ?? null,
          creator: skill.createdByResourceActor,
          fork:
            isFork && parent
              ? {
                  id: skill.id,
                  parentSkillId: parent.id,
                  creator: skill.createdByResourceActor,
                  originalCreator: parent.createdByResourceActor,
                  createdAt: skill.createdAt
                }
              : null,
          entity: {
            id: skill.skillEntityId,
            name: entity.name,
            slug: entity.slug ?? entity.id,
            description: entity.description,
            parentSkillId: entity.parentSkill?.id ?? null,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
          }
        },
        integrations: hydrationBySkillId.get(skill.id)?.integrations ?? [],
        providers: hydrationBySkillId.get(skill.id)?.providers ?? []
      };
    });
  }

  async hydrateSkill(skill: { id: string }) {
    let [hydrated] = await this.hydrateSkills([skill]);
    return hydrated!;
  }

  async hydrateSkillGroups(groups: SkillGroupRecord[]): Promise<SkillGroupResource[]> {
    let skills = await this.hydrateSkills(
      groups.flatMap(group => group.items.map(item => item.skill))
    );
    let skillById = new Map(skills.map(skill => [skill.id, skill]));
    return groups.map(group => ({
      ...group,
      localSkillGroup: group,
      skills: group.items
        .map(item => skillById.get(item.skill.id))
        .filter((skill): skill is SkillResource => !!skill)
    }));
  }

  async hydrateSkillGroup(group: SkillGroupRecord) {
    return (await this.hydrateSkillGroups([group]))[0]!;
  }

  async hydrateSkillGroupItems(
    items: SkillGroupItemRecord[]
  ): Promise<SkillGroupItemResource[]> {
    let skills = await this.hydrateSkills(items.map(item => item.skill));
    let skillById = new Map(skills.map(skill => [skill.id, skill]));
    return items
      .map(item => {
        let skill = skillById.get(item.skill.id);
        return skill
          ? {
              ...item,
              skillGroupId: item.skillGroup.id,
              skill
            }
          : null;
      })
      .filter((item): item is SkillGroupItemResource => !!item);
  }

  async hydrateSkillGroupItem(item: SkillGroupItemRecord) {
    return (await this.hydrateSkillGroupItems([item]))[0]!;
  }

  async hydrateSkillTemplates(
    templates: SkillTemplateHydrationInput[]
  ): Promise<SkillTemplateResource[]> {
    if (!templates.length) return [];
    let records = await db.skillTemplate.findMany({
      where: { id: { in: templates.map(template => template.id) } },
      include: {
        storeTemplate: true,
        instance: true
      }
    });
    let byId = new Map(records.map(template => [template.id, template]));
    let ordered = templates
      .map(input => {
        let template = byId.get(input.id);
        return template ? { input, template } : null;
      })
      .filter((item): item is NonNullable<typeof item> => !!item);
    return await Promise.all(
      ordered.map(async ({ input, template }) => {
        let items: SkillTemplateItemResource[] = [];
        if (template.instance) {
          let [hydrated] = await this.hydrateDelegatedSkillTemplateResources({
            instance: template.instance,
            skillTemplateIds: [template.id]
          });
          items = hydrated?.items ?? [];
        }
        let scopedStoreTemplate =
          input.storeTemplate && typeof input.storeTemplate === 'object'
            ? (input.storeTemplate as { storeId?: string | null })
            : undefined;
        let hasScopedStoreId =
          !!scopedStoreTemplate &&
          Object.prototype.hasOwnProperty.call(scopedStoreTemplate, 'storeId');
        let storeId = hasScopedStoreId
          ? (scopedStoreTemplate?.storeId ?? null)
          : template.storeId;
        let localSkillTemplate = {
          ...template,
          storeId
        };

        return {
          ...localSkillTemplate,
          localSkillTemplate,
          items
        };
      })
    );
  }

  async hydrateSkillTemplate(template: SkillTemplateHydrationInput) {
    return (await this.hydrateSkillTemplates([template]))[0]!;
  }
}

export let skillResourceService = Service.create(
  'cargoSkillResourceService',
  () => new SkillResourceServiceImpl()
).build();
