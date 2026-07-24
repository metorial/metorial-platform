import { Service } from '@lowerdeck/service';
import { db, type Prisma, type ResourceActor } from '@metorial/db';
import {
  subspaceSkillService,
  subspaceSkillItemService,
  subspaceSkillTemplateItemService,
  subspaceSkillTemplateService,
  type SubspaceIntegrationPreview,
  type SubspaceProviderPreview,
  type SubspaceSkillItem,
  type SubspaceSkillTemplateItem
} from '@metorial/module-subspace';
import type { SkillGroupRecord } from './skillGroup';
import type { SkillGroupItemRecord } from './skillGroupItem';

let skillResourceInclude = {
  store: true,
  parentSkill: {
    include: {
      createdByResourceActor: true
    }
  },
  parentSkillTemplate: {
    select: { id: true }
  },
  forkedFromSkillVersion: {
    include: {
      skill: {
        include: {
          createdByResourceActor: true
        }
      }
    }
  },
  createdByResourceActor: true,
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
    creator: ResourceActor | null;
    fork: {
      id: string;
      parentSkillId: string;
      creator: ResourceActor | null;
      originalCreator: ResourceActor | null;
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

export type SkillItemResource = SubspaceSkillItem;
export type SkillTemplateItemResource = SubspaceSkillTemplateItem;

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
      include: { instance: true }
    });
    if (!record?.instance) return;
    await subspaceSkillService.syncResourceTarget({
      instance: record.instance,
      skillId: record.id
    });
  }

  async ensureDelegatedSkillTemplate(template: { id: string }) {
    let record = await db.skillTemplate.findUnique({
      where: { id: template.id },
      include: { instance: true, storeTemplate: true }
    });
    if (!record?.instance) return;
    await subspaceSkillTemplateService.syncResourceTarget({
      instance: record.instance,
      id: record.id,
      status: record.status,
      owner: record.owner,
      slug: record.slug,
      name: record.name,
      description: record.description,
      metadata: record.metadata as any,
      storeId: undefined,
      storeTemplateId: record.storeTemplateId,
      systemIdentifier: record.systemIdentifier
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
    let [resources] = await subspaceSkillService.hydrateResources({
      instance: skill.instance,
      skillIds: [skill.id]
    });
    if (!resources) return;

    for (let integration of resources.integrations) {
      await subspaceSkillTemplateItemService.create({
        instance: skill.instance,
        skillTemplateId: d.skillTemplate.id,
        type: 'integration',
        integrationId: integration.id
      } as any);
    }
    for (let provider of resources.providers) {
      await subspaceSkillTemplateItemService.create({
        instance: skill.instance,
        skillTemplateId: d.skillTemplate.id,
        type: 'provider',
        providerId: provider.id
      } as any);
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
    let [resources] = await subspaceSkillService.hydrateResources({
      instance: target.instance,
      skillIds: [d.sourceSkill.id]
    });
    if (!resources) return;

    for (let item of resources.items) {
      if (item.integration) {
        await subspaceSkillItemService.create({
          instance: target.instance,
          skillId: target.id,
          type: 'integration',
          integrationId: item.integration.id
        } as any);
      } else if (item.provider) {
        await subspaceSkillItemService.create({
          instance: target.instance,
          skillId: target.id,
          type: 'provider',
          providerId: item.provider.id
        } as any);
      }
    }
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
    let [resources] = await subspaceSkillTemplateService.hydrateResources({
      instance: skill.instance,
      skillTemplateIds: [d.skillTemplate.id]
    });
    if (!resources) return;

    for (let item of resources.items) {
      if (item.integration) {
        await subspaceSkillItemService.create({
          instance: skill.instance,
          skillId: skill.id,
          type: 'integration',
          integrationId: item.integration.id
        } as any);
      } else if (item.provider) {
        await subspaceSkillItemService.create({
          instance: skill.instance,
          skillId: skill.id,
          type: 'provider',
          providerId: item.provider.id
        } as any);
      }
    }
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
      let hydrated = await subspaceSkillService.hydrateResources({
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
          let [hydrated] = await subspaceSkillTemplateService.hydrateResources({
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
