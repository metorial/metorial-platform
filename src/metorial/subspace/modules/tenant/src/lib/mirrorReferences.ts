import { db as subspaceDb } from '@metorial-subspace/db';

type RuntimeField = {
  name: string;
  kind: string;
  type: string;
  isList?: boolean;
};

export type MirrorClient = {
  _runtimeDataModel?: { models?: Record<string, { fields?: RuntimeField[] }> };
  [key: string]: any;
};

export type MirrorReference = {
  model: string;
  delegate: string;
  legacyField: 'tenantOid' | 'environmentOid';
  mirrorField: string;
};

export type MirrorReferencePlan = {
  fromTenant: MirrorReference[];
  fromEnvironment: MirrorReference[];
};

let MIRROR_SOURCE_MODELS = new Set(['Project', 'Instance']);

let MIRROR_TARGETS = {
  tenantOid: 'Project',
  environmentOid: 'Instance'
} as const;

let getModelsByScalarFields = (client: MirrorClient) => {
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

let resolveMirrorField = (d: {
  model: string;
  legacyField: keyof typeof MIRROR_TARGETS;
  runtimeFields: RuntimeField[];
  scalars: Set<string>;
}) => {
  let target = MIRROR_TARGETS[d.legacyField];

  let candidates = d.runtimeFields
    .filter(field => field.kind === 'object' && !field.isList && field.type === target)
    .map(field => `${field.name}Oid`);

  if (candidates.length !== 1) {
    throw new Error(
      `${d.model} has ${d.legacyField} but ${candidates.length} single relations to ${target}` +
        `${candidates.length ? ` (${candidates.join(', ')})` : ''}. ` +
        `Every model scoped by ${d.legacyField} needs exactly one nullable ${target} reference.`
    );
  }

  let mirrorField = candidates[0]!;

  if (!d.scalars.has(mirrorField)) {
    throw new Error(
      `${d.model}.${mirrorField} backs the ${target} relation but is not a writable scalar field.`
    );
  }

  return mirrorField;
};

export let buildMirrorReferencePlan = (client: MirrorClient): MirrorReferencePlan => {
  let models = client._runtimeDataModel?.models;

  if (!models || typeof models !== 'object') {
    throw new Error(
      'Prisma runtime data model is unavailable, so mirror columns cannot be told apart from ' +
        'unrelated references of the same type. Refusing to backfill.'
    );
  }

  let plan: MirrorReferencePlan = { fromTenant: [], fromEnvironment: [] };

  for (let [model, { delegate, scalars }] of getModelsByScalarFields(client)) {
    if (MIRROR_SOURCE_MODELS.has(model)) continue;

    let runtimeFields = models[model]?.fields;
    if (!runtimeFields) {
      throw new Error(`${model} is missing from the Prisma runtime data model.`);
    }

    for (let legacyField of ['tenantOid', 'environmentOid'] as const) {
      if (!scalars.has(legacyField)) continue;

      let reference: MirrorReference = {
        model,
        delegate,
        legacyField,
        mirrorField: resolveMirrorField({ model, legacyField, runtimeFields, scalars })
      };

      if (legacyField === 'tenantOid') plan.fromTenant.push(reference);
      else plan.fromEnvironment.push(reference);
    }
  }

  plan.fromTenant.sort((a, b) => a.model.localeCompare(b.model));
  plan.fromEnvironment.sort((a, b) => a.model.localeCompare(b.model));

  return plan;
};

let cachedPlan: MirrorReferencePlan | undefined;

export let getMirrorReferencePlan = () => {
  cachedPlan ??= buildMirrorReferencePlan(subspaceDb as unknown as MirrorClient);
  return cachedPlan;
};
