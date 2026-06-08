import { ConsumerGroup, ConsumerProfile, db, Instance, SkillTemplate } from '@metorial/db';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

type SubspaceSkillTemplateResult = Awaited<ReturnType<typeof subspace.skillTemplate.get>>;
type SubspaceSkillTemplateWithLocal = SubspaceSkillTemplateResult & {
  localSkillTemplate: SkillTemplate;
};
type ConsumerReadContext = {
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
};

export let syncSkillTemplateFromSubspace = async (d: {
  instance: Instance;
  skillTemplate: SubspaceSkillTemplateResult;
}) => {
  return await db.skillTemplate.upsert({
    where: {
      id: d.skillTemplate.id
    },
    create: {
      id: d.skillTemplate.id,
      status: d.skillTemplate.status,
      owner: d.skillTemplate.owner,
      slug: d.skillTemplate.slug,
      name: d.skillTemplate.name,
      description: d.skillTemplate.description,
      metadata: d.skillTemplate.metadata,
      storeId: d.skillTemplate.storeId,
      storeTemplateId: d.skillTemplate.storeTemplateId,
      organizationOid: d.instance.organizationOid,
      instanceOid: d.instance.oid,
      createdAt: d.skillTemplate.createdAt,
      updatedAt: d.skillTemplate.updatedAt
    },
    update: {
      status: d.skillTemplate.status,
      owner: d.skillTemplate.owner,
      slug: d.skillTemplate.slug,
      name: d.skillTemplate.name,
      description: d.skillTemplate.description,
      metadata: d.skillTemplate.metadata,
      storeId: d.skillTemplate.storeId,
      storeTemplateId: d.skillTemplate.storeTemplateId,
      updatedAt: d.skillTemplate.updatedAt
    }
  });
};

let localSkillTemplateNeedsSync = (d: {
  skillTemplate: SubspaceSkillTemplateResult;
  localSkillTemplate: SkillTemplate | undefined;
}) => {
  if (!d.localSkillTemplate) return true;

  if (d.localSkillTemplate.status !== d.skillTemplate.status) return true;
  if (d.localSkillTemplate.owner !== d.skillTemplate.owner) return true;
  if (d.localSkillTemplate.slug !== d.skillTemplate.slug) return true;
  if (d.localSkillTemplate.name !== d.skillTemplate.name) return true;
  if (d.localSkillTemplate.description !== d.skillTemplate.description) return true;
  if (d.localSkillTemplate.storeId !== d.skillTemplate.storeId) return true;
  if (d.localSkillTemplate.storeTemplateId !== d.skillTemplate.storeTemplateId) {
    return true;
  }
  if (d.localSkillTemplate.updatedAt.getTime() !== d.skillTemplate.updatedAt.getTime()) {
    return true;
  }

  return false;
};

let enrichSkillTemplatesFromList = async (d: {
  instance: Instance;
  skillTemplates: SubspaceSkillTemplateResult[];
}) => {
  if (!d.skillTemplates.length) return [];

  let existing = await db.skillTemplate.findMany({
    where: {
      id: {
        in: d.skillTemplates.map(skillTemplate => skillTemplate.id)
      }
    }
  });
  let existingById = new Map(existing.map(skillTemplate => [skillTemplate.id, skillTemplate]));
  let synced = await Promise.all(
    d.skillTemplates
      .filter(skillTemplate =>
        localSkillTemplateNeedsSync({
          skillTemplate,
          localSkillTemplate: existingById.get(skillTemplate.id)
        })
      )
      .map(skillTemplate =>
        syncSkillTemplateFromSubspace({
          instance: d.instance,
          skillTemplate
        })
      )
  );
  let localById = new Map([
    ...existing.map(skillTemplate => [skillTemplate.id, skillTemplate] as const),
    ...synced.map(skillTemplate => [skillTemplate.id, skillTemplate] as const)
  ]);

  return d.skillTemplates.map(skillTemplate => ({
    ...skillTemplate,
    localSkillTemplate: localById.get(skillTemplate.id)!
  }));
};

let enrichSkillTemplate = async (d: {
  instance: Instance;
  skillTemplate: SubspaceSkillTemplateResult;
}): Promise<SubspaceSkillTemplateWithLocal> => {
  let [skillTemplate] = await enrichSkillTemplatesFromList({
    instance: d.instance,
    skillTemplates: [d.skillTemplate]
  });

  return skillTemplate;
};

export let syncSkillTemplatesFromSubspace = async (d: {
  instance: Instance;
  skillTemplates: SubspaceSkillTemplateResult[];
}) => {
  return (await enrichSkillTemplatesFromList(d)).map(
    skillTemplate => skillTemplate.localSkillTemplate
  );
};

let intersectIds = (allowedIds: string[], requestedIds?: string[]) => {
  let uniqueAllowedIds = [...new Set(allowedIds)];
  if (!requestedIds?.length) return uniqueAllowedIds;

  let requestedIdSet = new Set(requestedIds);
  return uniqueAllowedIds.filter(id => requestedIdSet.has(id));
};

let requireConsumerReadContext = (d: ConsumerReadContext) => {
  if (!d.consumerProfile) return null;
  return {
    consumerProfile: d.consumerProfile,
    consumerGroups: d.consumerGroups ?? []
  };
};

let getAccessibleSkillTemplateIds = async (d: {
  instance: Instance;
  consumerGroups: Pick<ConsumerGroup, 'oid'>[];
  requestedIds?: string[];
}) => {
  let skillTemplates = await db.skillTemplate.findMany({
    where: {
      instanceOid: d.instance.oid,
      consumerAccesses: {
        some: {
          consumerGroupOid: {
            in: d.consumerGroups.map(group => group.oid)
          }
        }
      }
    },
    select: {
      id: true
    }
  });

  return intersectIds(
    skillTemplates.map(skillTemplate => skillTemplate.id),
    d.requestedIds
  );
};

let assertSkillTemplateReadable = async (d: {
  instance: Instance;
  skillTemplateId: string;
  consumerProfile?: ConsumerProfile;
  consumerGroups?: Pick<ConsumerGroup, 'oid'>[];
}) => {
  if (!d.consumerProfile) return;

  let skillTemplate = await db.skillTemplate.findFirst({
    where: {
      instanceOid: d.instance.oid,
      id: d.skillTemplateId,
      consumerAccesses: {
        some: {
          consumerGroupOid: {
            in: d.consumerGroups?.map(group => group.oid) ?? []
          }
        }
      }
    }
  });

  if (!skillTemplate) throw new Error('Skill template not found');
};

export let subspaceSkillTemplateService = createSubspaceService(
  subspace.skillTemplate,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({
    get: async (arg0: Parameters<typeof inner.get>[0] & ConsumerReadContext) => {
      await assertSkillTemplateReadable({
        instance: arg0.instance,
        skillTemplateId: arg0.skillTemplateId,
        consumerProfile: arg0.consumerProfile,
        consumerGroups: arg0.consumerGroups
      });

      let { consumerProfile, consumerGroups, ...input } = arg0;
      let skillTemplate = await inner.get(input);
      return await enrichSkillTemplate({
        instance: arg0.instance,
        skillTemplate
      });
    },
    list: async (arg0: Parameters<typeof inner.list>[0] & ConsumerReadContext) => {
      let readContext = requireConsumerReadContext(arg0);
      let ids = readContext
        ? await getAccessibleSkillTemplateIds({
            instance: arg0.instance,
            consumerGroups: readContext.consumerGroups,
            requestedIds: arg0.ids
          })
        : arg0.ids;
      let { consumerProfile, consumerGroups, ...input } = arg0;
      let paginator = await inner.list({
        ...input,
        ids
      });
      return paginator.map(skillTemplates =>
        enrichSkillTemplatesFromList({
          instance: arg0.instance,
          skillTemplates
        })
      );
    },
    create: async (...params: Parameters<typeof inner.create>) => {
      let skillTemplate = await inner.create(...params);
      return await enrichSkillTemplate({
        instance: params[0].instance,
        skillTemplate
      });
    },
    update: async (...params: Parameters<typeof inner.update>) => {
      let skillTemplate = await inner.update(...params);
      return await enrichSkillTemplate({
        instance: params[0].instance,
        skillTemplate
      });
    },
    delete: async (...params: Parameters<typeof inner.delete>) => {
      let skillTemplate = await inner.delete(...params);
      return await enrichSkillTemplate({
        instance: params[0].instance,
        skillTemplate
      });
    }
  })
);

export type SubspaceSkillTemplate = SubspaceSkillTemplateWithLocal;
