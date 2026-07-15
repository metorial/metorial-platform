import { db } from '@metorial-cargo/db';
import { createResolver } from '../resolver';

export let resolveSkills = createResolver(async ({ scope, ids }) =>
  db.skill.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveSkillMarketplaces = createResolver(async ({ scope, ids }) =>
  db.skillMarketplace.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveSkillMarketplacePlugins = createResolver(async ({ scope, ids }) =>
  db.skillMarketplacePlugin.findMany({
    where: {
      id: { in: ids },
      skillMarketplace: scope,
      skillPlugin: scope
    },
    select: { oid: true }
  })
);

export let resolveSkillPlugins = createResolver(async ({ scope, ids }) =>
  db.skillPlugin.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveSkillPluginSkills = createResolver(async ({ scope, ids }) =>
  db.skillPluginSkill.findMany({
    where: {
      id: { in: ids },
      skillPlugin: scope,
      skill: scope
    },
    select: { oid: true }
  })
);

export let resolveSkillAgents = createResolver(async ({ scope, ids }) =>
  db.skillAgent.findMany({
    where: {
      id: { in: ids },
      skill: scope
    },
    select: { oid: true }
  })
);

export let resolveSkillConfigurations = createResolver(async ({ scope, ids }) =>
  db.skillConfiguration.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveSkillTemplates = createResolver(async ({ scope, ids }) =>
  db.skillTemplate.findMany({
    where: {
      id: { in: ids },
      OR: [
        {
          tenantOid: scope.tenantOid,
          environmentOid: scope.environmentOid
        },
        {
          tenantOid: null,
          environmentOid: null
        }
      ]
    },
    select: { oid: true }
  })
);

export let resolveSkillVersions = createResolver(async ({ scope, ids }) =>
  db.skillVersion.findMany({
    where: {
      id: { in: ids },
      skill: scope
    },
    select: { oid: true }
  })
);

export let resolveSkillParticipants = createResolver(async ({ scope, ids }) =>
  db.skillParticipant.findMany({
    where: {
      id: { in: ids },
      skill: scope
    },
    select: { oid: true }
  })
);

export let resolveSkillMergeRequests = createResolver(async ({ scope, ids }) =>
  db.skillMergeRequest.findMany({
    where: {
      ...scope,
      id: { in: ids }
    },
    select: { oid: true }
  })
);
