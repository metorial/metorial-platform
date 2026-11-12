import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseWith, SourceValidationError } from '../lib/validate';
import type { ModelMerge } from '../pipeline/canonicalize';

export let defaultOverridesDir = path.join(import.meta.dirname, '..', '..', 'overrides');

let maxReasonLength = 400;

export let exclusionCategories = [
  'fine-tune',
  'deployment',
  'non-chat',
  'test',
  'other'
] as const;

let isoDay = v.string({ modifiers: [v.regex(/^\d{4}-\d{2}-\d{2}$/)] });

let provenance = {
  reason: v.string({ modifiers: [v.minLength(1), v.maxLength(maxReasonLength)] }),
  by: v.optional(v.enumOf(['human', 'agent'])),
  at: v.optional(isoDay)
};

let decisionSchemas = {
  link: v.object({ decision: v.literal('link'), model: v.string(), ...provenance }),
  router: v.object({ decision: v.literal('router'), ...provenance }),
  exclude: v.object({
    decision: v.literal('exclude'),
    category: v.enumOf(exclusionCategories),
    ...provenance
  }),
  defer: v.object({ decision: v.literal('defer'), until: isoDay, ...provenance })
};

let mergeSchema = v.object({ from: v.array(v.string()), ...provenance });

let modelPatchSchema = v.object({
  name: v.optional(v.string()),
  familyId: v.optional(v.string()),
  derivedFrom: v.optional(v.string()),
  ...provenance
});

let familyPatchSchema = v.object({ name: v.optional(v.string()), ...provenance });

export type OfferingDecision = {
  [K in keyof typeof decisionSchemas]: ValidationTypeValue<(typeof decisionSchemas)[K]>;
}[keyof typeof decisionSchemas];

export type DecisionKind = OfferingDecision['decision'];

export let decisionKinds = Object.keys(decisionSchemas) as DecisionKind[];

// The on-disk shape: plain JSON maps keyed by the thing being overridden, so a human or an agent
// edits one entry without touching any other.
export interface OverrideFiles {
  merges: Record<string, ValidationTypeValue<typeof mergeSchema>>;
  models: Record<string, ValidationTypeValue<typeof modelPatchSchema>>;
  families: Record<string, ValidationTypeValue<typeof familyPatchSchema>>;
  offerings: Record<string, Record<string, OfferingDecision>>;
}

export type OfferingOverrideTarget =
  { kind: 'model'; modelId: string } | { kind: 'router' } | { kind: 'unresolved' };

export interface OfferingOverride {
  id: string;
  vendorId: string;
  vendorModelId: string;
  decision: DecisionKind;
  target: OfferingOverrideTarget;
  until: string | null;
  reason: string;
}

export interface ModelPatch {
  modelId: string;
  name?: string;
  familyId?: string;
  derivedFrom?: string;
}

export interface FamilyPatch {
  familyId: string;
  name?: string;
}

export interface Overrides {
  merges: (ModelMerge & { reason: string })[];
  offerings: OfferingOverride[];
  models: ModelPatch[];
  families: FamilyPatch[];
}

export let emptyOverrides = (): Overrides => ({
  merges: [],
  offerings: [],
  models: [],
  families: []
});

export let offeringOverrideId = (vendorId: string, vendorModelId: string) =>
  `${vendorId}/${vendorModelId}`;

export let parseDecision = (value: unknown, context: string): OfferingDecision => {
  let kind = (value as { decision?: unknown } | null)?.decision;
  let schema = decisionSchemas[kind as DecisionKind];
  if (typeof kind !== 'string' || !schema)
    throw new SourceValidationError(
      `${context}: decision must be one of ${decisionKinds.join(', ')}`
    );

  return parseWith(schema as typeof decisionSchemas.link, value, context);
};

let parseRecord = <T>(
  value: unknown,
  context: string,
  parse: (item: unknown, key: string) => T
) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new SourceValidationError(`${context}: expected an object keyed by id`);

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, parse(item, `${context} ${key}`)])
  );
};

let readJson = async (file: string) => {
  if (!existsSync(file)) return {};

  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  } catch (err) {
    throw new SourceValidationError(`${file}: ${(err as Error).message}`);
  }
};

export let readOverrideFiles = async (dir = defaultOverridesDir): Promise<OverrideFiles> => {
  let offeringsDir = path.join(dir, 'offerings');
  let vendorFiles = existsSync(offeringsDir)
    ? (await readdir(offeringsDir)).filter(file => file.endsWith('.json')).sort()
    : [];

  let offerings: OverrideFiles['offerings'] = {};
  for (let file of vendorFiles) {
    let vendorId = file.slice(0, -'.json'.length);
    offerings[vendorId] = parseRecord(
      await readJson(path.join(offeringsDir, file)),
      `offerings/${file}`,
      parseDecision
    );
  }

  return {
    merges: parseRecord(
      await readJson(path.join(dir, 'merges.json')),
      'merges.json',
      (item, ctx) => parseWith(mergeSchema, item, ctx)
    ),
    models: parseRecord(
      await readJson(path.join(dir, 'models.json')),
      'models.json',
      (item, ctx) => parseWith(modelPatchSchema, item, ctx)
    ),
    families: parseRecord(
      await readJson(path.join(dir, 'families.json')),
      'families.json',
      (item, ctx) => parseWith(familyPatchSchema, item, ctx)
    ),
    offerings
  };
};

let decisionTarget = (decision: OfferingDecision): OfferingOverrideTarget => {
  if (decision.decision === 'link') return { kind: 'model', modelId: decision.model };
  if (decision.decision === 'router') return { kind: 'router' };
  return { kind: 'unresolved' };
};

export let compileOverrides = (files: OverrideFiles): Overrides => ({
  merges: Object.entries(files.merges).map(([into, merge]) => ({
    into,
    from: merge.from,
    reason: merge.reason
  })),
  offerings: Object.entries(files.offerings).flatMap(([vendorId, decisions]) =>
    Object.entries(decisions).map(([vendorModelId, decision]) => ({
      id: offeringOverrideId(vendorId, vendorModelId),
      vendorId,
      vendorModelId,
      decision: decision.decision,
      target: decisionTarget(decision),
      until: decision.decision === 'defer' ? decision.until : null,
      reason: decision.reason
    }))
  ),
  models: Object.entries(files.models).map(([modelId, patch]) => ({
    modelId,
    name: patch.name,
    familyId: patch.familyId,
    derivedFrom: patch.derivedFrom
  })),
  families: Object.entries(files.families).map(([familyId, patch]) => ({
    familyId,
    name: patch.name
  }))
});

export let loadOverrides = async (dir = defaultOverridesDir) =>
  compileOverrides(await readOverrideFiles(dir));

let fieldOrder = [
  'decision',
  'model',
  'category',
  'until',
  'from',
  'name',
  'familyId',
  'derivedFrom',
  'reason',
  'by',
  'at'
];

let ordered = (entry: object) =>
  Object.fromEntries(
    Object.entries(entry)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => fieldOrder.indexOf(a) - fieldOrder.indexOf(b))
  );

let sortedRecord = (record: Record<string, object>) =>
  Object.fromEntries(
    Object.keys(record)
      .sort()
      .map(key => [key, ordered(record[key]!)])
  );

// Prettier keeps short string arrays on one line; matching it means a formatter run on these
// files is a no-op.
let serialize = (value: unknown) =>
  `${JSON.stringify(value, null, 2).replace(
    /\[\s+((?:"(?:[^"\\]|\\.)*"(?:,\s+)?)+)\s+\]/g,
    (_, items: string) => `[${items.replace(/",\s+"/g, '", "')}]`
  )}\n`;

// Writes the whole set: vendor files without decisions are removed, so the directory always
// matches `files` exactly.
export let writeOverrideFiles = async (files: OverrideFiles, dir = defaultOverridesDir) => {
  let offeringsDir = path.join(dir, 'offerings');
  await mkdir(offeringsDir, { recursive: true });

  await writeFile(path.join(dir, 'merges.json'), serialize(sortedRecord(files.merges)));
  await writeFile(path.join(dir, 'models.json'), serialize(sortedRecord(files.models)));
  await writeFile(path.join(dir, 'families.json'), serialize(sortedRecord(files.families)));

  let kept = new Set<string>();
  for (let [vendorId, decisions] of Object.entries(files.offerings)) {
    if (!Object.keys(decisions).length) continue;

    kept.add(`${vendorId}.json`);
    await writeFile(
      path.join(offeringsDir, `${vendorId}.json`),
      serialize(sortedRecord(decisions))
    );
  }

  for (let file of await readdir(offeringsDir))
    if (!kept.has(file)) await rm(path.join(offeringsDir, file), { force: true });
};
