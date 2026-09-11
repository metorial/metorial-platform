import { db as subspaceDb } from '@metorial-subspace/db';

export type RuntimeField = {
  name: string;
  kind: string;
  type: string;
  isList?: boolean;
};

export type ScopedClient = {
  _runtimeDataModel?: { models?: Record<string, { fields?: RuntimeField[] }> };
  [key: string]: any;
};

export let getModelsByScalarFields = (client: ScopedClient) => {
  let byModel = new Map<string, { delegate: string; scalars: Set<string> }>();

  for (let key of Object.keys(client)) {
    if (key.startsWith('$') || key.startsWith('_') || key === 'constructor') continue;

    let fields = client[key]?.fields;
    if (!fields || typeof fields !== 'object') continue;

    let refs = Object.values(fields) as { modelName?: string; name?: string }[];
    let model = refs.find(ref => ref.modelName)?.modelName;
    if (!model) continue;

    byModel.set(model, {
      delegate: key,
      scalars: new Set(refs.map(ref => ref.name).filter((name): name is string => !!name))
    });
  }

  return byModel;
};

export type ScopedModel = {
  model: string;
  delegate: string;
  hasTenantOid: boolean;
};

export type ScopedModelPlan = {
  environmentScoped: ScopedModel[];
  tenantScopedOnly: ScopedModel[];
};

let EXCLUDED_MODELS = new Set(['Project', 'Instance', 'Tenant', 'Environment']);

export let buildScopedModelPlan = (client: ScopedClient): ScopedModelPlan => {
  if (!client._runtimeDataModel?.models) {
    throw new Error(
      'Prisma runtime data model is unavailable, so scoped models cannot be enumerated. ' +
        'Refusing to move tenant-scoped rows.'
    );
  }

  let plan: ScopedModelPlan = { environmentScoped: [], tenantScopedOnly: [] };

  for (let [model, { delegate, scalars }] of getModelsByScalarFields(client)) {
    if (EXCLUDED_MODELS.has(model)) continue;

    let hasTenantOid = scalars.has('tenantOid');
    let hasEnvironmentOid = scalars.has('environmentOid');

    if (hasEnvironmentOid) plan.environmentScoped.push({ model, delegate, hasTenantOid });
    else if (hasTenantOid) plan.tenantScopedOnly.push({ model, delegate, hasTenantOid });
  }

  plan.environmentScoped.sort((a, b) => a.model.localeCompare(b.model));
  plan.tenantScopedOnly.sort((a, b) => a.model.localeCompare(b.model));

  return plan;
};

let cachedPlan: ScopedModelPlan | undefined;

let getScopedModelPlan = () => {
  cachedPlan ??= buildScopedModelPlan(subspaceDb as unknown as ScopedClient);
  return cachedPlan;
};

export let getEnvironmentScopedModels = () => getScopedModelPlan().environmentScoped;

export let getTenantScopedOnlyModels = () => getScopedModelPlan().tenantScopedOnly;
