import { normalizeAgentKey } from '@metorial/model-catalog/src/pipeline/agents';
import { normalizeKey, parseName } from '@metorial/model-catalog/src/normalize/parseName';
import { db } from '@mtsrc/agent-tracking-db';
import { getKnowledge } from './cache';

let labHintCacheSize = 10_000;

export type DimensionModel = {
  labId: string;
  familyId: string | null;
  kind: string;
  status: string;
  openWeights: boolean;
};

export type DimensionAgent = { makerId: string; aliasKeys: string[] };

export type DimensionMaps = {
  version: string | null;
  models: Map<string, DimensionModel>;
  latestModelIds: Set<string>;
  vendorKinds: Map<string, string>;
  agents: Map<string, DimensionAgent>;
  agentOf: (clientFamily: string) => string | null;
  labHintOf: (modelRaw: string) => string | null;
};

export type DimensionRows = {
  version: string | null;
  models: ({ id: string } & DimensionModel)[];
  families: { id: string; latestModelId: string | null }[];
  vendors: { id: string; kind: string }[];
  agents: ({ id: string; removed: boolean } & DimensionAgent)[];
  organizations: { id: string; roles: string[]; aliases: string[] }[];
};

let aliasForms = (value: string) => {
  let key = normalizeKey(value);
  return [value.toLowerCase(), key, key.replace(/-/g, '')];
};

export let createDimensionMaps = (rows: DimensionRows): DimensionMaps => {
  let agentsByKey = new Map<string, string>();
  let orderedAgents = [...rows.agents].sort((a, b) => Number(a.removed) - Number(b.removed));

  for (let agent of orderedAgents) {
    for (let key of agent.aliasKeys) if (!agentsByKey.has(key)) agentsByKey.set(key, agent.id);
  }

  let labAliases = new Map<string, string>();

  for (let organization of rows.organizations) {
    if (!organization.roles.includes('lab')) continue;

    for (let alias of [organization.id, ...organization.aliases]) {
      for (let form of aliasForms(alias)) {
        if (!labAliases.has(form)) labAliases.set(form, organization.id);
      }
    }
  }

  let resolveLab = (alias: string) => {
    for (let form of aliasForms(alias)) {
      let id = labAliases.get(form);
      if (id) return id;
    }

    return null;
  };

  let labHints = new Map<string, string | null>();

  return {
    version: rows.version,
    models: new Map(rows.models.map(({ id, ...model }) => [id, model])),
    latestModelIds: new Set(
      rows.families.flatMap(family => (family.latestModelId ? [family.latestModelId] : []))
    ),
    vendorKinds: new Map(rows.vendors.map(vendor => [vendor.id, vendor.kind])),
    agents: new Map(
      rows.agents.map(agent => [
        agent.id,
        { makerId: agent.makerId, aliasKeys: agent.aliasKeys }
      ])
    ),

    agentOf: clientFamily => agentsByKey.get(normalizeAgentKey(clientFamily)) ?? null,

    labHintOf: modelRaw => {
      let cached = labHints.get(modelRaw);
      if (cached !== undefined) return cached;

      let hint = parseName(modelRaw, { resolveOrg: resolveLab }).labHint;
      if (labHints.size >= labHintCacheSize) labHints.clear();
      labHints.set(modelRaw, hint);

      return hint;
    }
  };
};

let emptyRows = (version: string | null): DimensionRows => ({
  version,
  models: [],
  families: [],
  vendors: [],
  agents: [],
  organizations: []
});

// Removed rows stay mappable: stored slices keep their upstream ids after a soft delete.
export let loadDimensionRows = async (version: string): Promise<DimensionRows> => {
  let [models, families, vendors, agents, organizations] = await Promise.all([
    db.knowledgeModel.findMany({
      select: {
        id: true,
        labId: true,
        familyId: true,
        kind: true,
        status: true,
        openWeights: true
      }
    }),
    db.knowledgeFamily.findMany({ select: { id: true, latestModelId: true } }),
    db.knowledgeVendor.findMany({ select: { id: true, kind: true } }),
    db.knowledgeAgent.findMany({
      select: { id: true, makerId: true, aliasKeys: true, removedAt: true }
    }),
    db.$queryRaw<{ id: string; roles: string[]; aliases: string[] | null }[]>`
      SELECT id, roles, ARRAY(SELECT jsonb_array_elements_text(COALESCE(data->'aliases', '[]'::jsonb))) AS aliases
      FROM "KnowledgeOrganization"`
  ]);

  return {
    version,
    models,
    families,
    vendors,
    agents: agents.map(({ removedAt, ...agent }) => ({ ...agent, removed: !!removedAt })),
    organizations: organizations.map(organization => ({
      ...organization,
      aliases: organization.aliases ?? []
    }))
  };
};

let state: { version: string | null; maps: DimensionMaps } | null = null;
let loading: { version: string; promise: Promise<DimensionMaps> } | null = null;

export let getDimensionMaps = async (): Promise<DimensionMaps> => {
  let version = (await getKnowledge())?.version ?? null;
  if (state && state.version === version) return state.maps;

  if (!version) {
    state = { version, maps: createDimensionMaps(emptyRows(null)) };
    return state.maps;
  }

  if (loading?.version != version) {
    let stale = state?.maps;
    let promise = loadDimensionRows(version)
      .then(rows => {
        let maps = createDimensionMaps(rows);
        if (loading?.version == version) state = { version, maps };
        return maps;
      })
      .catch(error => {
        if (!stale) throw error;

        console.warn('[agent-tracking] usage dimension maps could not be loaded', error);
        return stale;
      })
      .finally(() => {
        if (loading?.promise == promise) loading = null;
      });

    loading = { version, promise };
  }

  return await loading.promise;
};

export let resetDimensionMaps = () => {
  state = null;
  loading = null;
};
