import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sortBy } from '../lib/util';
import { loadOverrides, type OfferingOverride, type Overrides } from '../overrides';
import { loadAiGateway } from '../sources/aiGateway';
import { loadAiSdk } from '../sources/aiSdk';
import { readPinnedSources, type SourceResult } from '../sources/fetch';
import { loadLiteLlm } from '../sources/litellm';
import { readModelsDev, type ModelsDevSnapshot } from '../sources/modelsDev';
import { loadOpenRouter } from '../sources/openrouter';
import type { Catalog, CatalogSource, Offering, ResolutionMethod, SourceKind } from '../types';
import {
  canonicalize,
  collectSourceFiles,
  linkFamilies,
  type CanonicalCatalog
} from './canonicalize';
import { buildAgents } from './agents';
import { applyContinuity, type CatalogDiff } from './continuity';
import { buildNames } from './names';
import { buildModelsDevOfferings } from './offerings';
import { buildOrganizations } from './organizations';
import { collectIssues, type CatalogIssue } from './issues';
import { createResolver } from './resolver';
import {
  chatListingCovers,
  gatewayDraft,
  mergeVendorListing,
  openRouterDraft,
  type SecondaryMergeStats
} from './secondary';
import {
  findPriceOutliers,
  validateCatalog,
  type PriceOutlier,
  type ValidationResult
} from './validate';
import { buildVendors } from './vendors';

export interface BuildOptions {
  modelsDevPath: string;
  previousDir: string | null;
  offline: boolean;
  sourcesDir?: string | null;
  now?: string;
  overrides?: Overrides;
}

export interface BuildResult {
  catalog: Catalog;
  diff: CatalogDiff;
  validation: ValidationResult;
  newPriceOutliers: PriceOutlier[];
  issues: CatalogIssue[];
  merges: SecondaryMergeStats[];
  resolutionCounts: Record<ResolutionMethod, number>;
  logoSources: Map<string, string>;
  rawSources: Map<SourceKind, unknown>;
  sourceIssues: string[];
  staleOverrides: OfferingOverride[];
  modelsDevSha: string;
}

let readPreviousCatalog = async (previousDir: string | null) => {
  if (!previousDir) return null;

  let file = path.join(previousDir, 'catalog.json');
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, 'utf8')) as Catalog;
};

let checkMergeTargets = (catalog: CanonicalCatalog, patches: Overrides) => {
  let missing = patches.merges
    .map(merge => merge.into)
    .filter(modelId => !catalog.models.has(modelId));

  if (missing.length)
    throw new Error(`overrides reference unknown models: ${missing.join(', ')}`);
};

// Offering decisions are reconciled automatically, so one whose model has since left models.dev,
// or a deferral that ran out, drops back to normal resolution and is raised again as an issue
// instead of failing the build.
let activeOfferingOverrides = (catalog: CanonicalCatalog, patches: Overrides, now: string) => {
  let today = now.slice(0, 10);
  let stale: OfferingOverride[] = [];

  let active = patches.offerings.filter(override => {
    if (override.until && override.until <= today) return false;
    if (override.target.kind === 'model' && !catalog.models.has(override.target.modelId)) {
      stale.push(override);
      return false;
    }
    return true;
  });

  return { active, stale };
};

let applyPatches = (catalog: CanonicalCatalog, patches: Overrides) => {
  for (let patch of patches.models) {
    let model = catalog.models.get(patch.modelId);
    if (!model) throw new Error(`override patches unknown model ${patch.modelId}`);

    if (patch.name) model.name = patch.name;
    if (patch.familyId) model.familyId = patch.familyId;
    if (patch.derivedFrom) model.derivedFrom = patch.derivedFrom;
  }

  catalog.families = linkFamilies(catalog.models);

  for (let patch of patches.families) {
    let family = catalog.families.get(patch.familyId);
    if (!family) throw new Error(`override patches unknown family ${patch.familyId}`);
    if (patch.name) family.name = patch.name;
  }
};

let countResolutions = (offerings: Iterable<Offering>) => {
  let counts = {
    override: 0,
    'base-model': 0,
    'first-party': 0,
    'exact-key': 0,
    'learned-alias': 0,
    'snapshot-date': 0,
    pointer: 0,
    structural: 0,
    router: 0,
    unresolved: 0
  } satisfies Record<ResolutionMethod, number>;

  for (let offering of offerings)
    if (offering.status !== 'retired') counts[offering.resolution.method]++;

  return counts;
};

let assignOfferingCounts = (catalog: CanonicalCatalog, offerings: Iterable<Offering>) => {
  for (let model of catalog.models.values()) model.offeringCount = 0;

  for (let offering of offerings) {
    if (!offering.modelId || offering.status === 'retired') continue;
    let model = catalog.models.get(offering.modelId);
    if (model) model.offeringCount++;
  }
};

// Without a previous catalog nothing can be called new, so the gate reports that case on its own.
let newOutliers = (outliers: PriceOutlier[], previous: Catalog | null) => {
  if (!previous) return [];

  let known = new Set(findPriceOutliers(previous).map(outlier => outlier.offeringId));
  return outliers.filter(outlier => !known.has(outlier.offeringId));
};

let modelsDevSource = (snapshot: ModelsDevSnapshot, now: string): CatalogSource => ({
  kind: 'models.dev',
  ref: snapshot.sha,
  fetchedAt: now,
  status: 'fresh',
  error: null
});

export let buildCatalog = async (opts: BuildOptions): Promise<BuildResult> => {
  let now = opts.now ?? new Date().toISOString();
  let patches = opts.overrides ?? (await loadOverrides());
  let sourceOpts = {
    offline: opts.offline,
    previousDir: opts.previousDir,
    pinned: opts.sourcesDir ? await readPinnedSources(opts.sourcesDir) : null,
    now
  };

  let [snapshot, openrouter, gateway, litellm, aiSdk, previous] = await Promise.all([
    readModelsDev(opts.modelsDevPath),
    loadOpenRouter(sourceOpts),
    loadAiGateway(sourceOpts),
    loadLiteLlm(sourceOpts),
    loadAiSdk(sourceOpts),
    readPreviousCatalog(opts.previousDir)
  ]);

  let orgs = buildOrganizations(snapshot);
  let vendors = buildVendors(snapshot, orgs);
  let agents = buildAgents({ orgs, vendors: vendors.vendors });
  let files = collectSourceFiles(snapshot, orgs, vendors);
  let canonical = canonicalize(files, orgs, patches.merges);

  checkMergeTargets(canonical, patches);
  applyPatches(canonical, patches);

  let offeringOverrides = activeOfferingOverrides(canonical, patches, now);
  let resolver = createResolver(canonical, orgs, vendors, offeringOverrides.active);
  let offerings = buildModelsDevOfferings(snapshot, vendors, canonical, resolver, now);
  let merges: SecondaryMergeStats[] = [];

  if (openrouter.data) {
    let aliases = new Map(
      openrouter.data
        .filter(model => model.canonical_slug)
        .map(model => [model.id, model.canonical_slug!])
    );

    merges.push(
      mergeVendorListing({
        source: 'openrouter',
        drafts: openrouter.data
          .map(model => openRouterDraft(model, vendors))
          .filter(draft => !!draft),
        aliases,
        covers: chatListingCovers(canonical),
        offerings,
        catalog: canonical,
        resolver,
        now
      })
    );
  }

  if (gateway.data) {
    merges.push(
      mergeVendorListing({
        source: 'ai-gateway',
        drafts: gateway.data
          .map(model => gatewayDraft(model, vendors))
          .filter(draft => !!draft),
        offerings,
        catalog: canonical,
        resolver,
        now
      })
    );
  }

  assignOfferingCounts(canonical, offerings.values());

  let names = buildNames({
    catalog: canonical,
    offerings,
    orgs,
    vendors,
    resolver,
    litellm: litellm.data,
    aiSdk: aiSdk.data,
    openrouter: openrouter.data,
    now
  });

  let secondary: SourceResult<unknown>[] = [openrouter, gateway, litellm, aiSdk];
  let current: Catalog = {
    schemaVersion: 1,
    generatedAt: now,
    sources: [modelsDevSource(snapshot, now), ...secondary.map(source => source.meta)],
    organizations: [...orgs.organizations.values()],
    families: [...canonical.families.values()],
    models: [...canonical.models.values()],
    releases: [...canonical.releases.values()],
    pointers: [...canonical.pointers.values()],
    vendors: [...vendors.vendors.values()],
    endpoints: [...vendors.endpoints.values()],
    offerings: [...offerings.values()],
    names: [...names.values()],
    agents: agents.agents
  };

  let { catalog, diff } = applyContinuity(current, previous, now);
  let sorted = sortCatalog(catalog);
  let validation = validateCatalog(sorted);

  return {
    catalog: sorted,
    diff,
    validation,
    newPriceOutliers: newOutliers(validation.priceOutliers, previous),
    issues: collectIssues({
      catalog: sorted,
      validation,
      staleOverrides: offeringOverrides.stale
    }),
    merges,
    resolutionCounts: countResolutions(sorted.offerings),
    logoSources: new Map([...orgs.logoSources, ...vendors.logoSources]),
    rawSources: new Map(
      secondary
        .filter(source => source.raw !== null)
        .map(source => [source.meta.kind, source.raw])
    ),
    sourceIssues: [
      ...snapshot.issues,
      ...secondary.flatMap(source => source.issues),
      ...agents.issues
    ],
    staleOverrides: offeringOverrides.stale,
    modelsDevSha: snapshot.sha
  };
};

let sortCatalog = (catalog: Catalog): Catalog => {
  let byId = <T extends { id: string }>(items: T[]) => sortBy(items, item => item.id);

  return {
    ...catalog,
    organizations: byId(catalog.organizations),
    families: byId(catalog.families),
    models: byId(catalog.models),
    releases: byId(catalog.releases),
    pointers: byId(catalog.pointers),
    vendors: byId(catalog.vendors),
    endpoints: byId(catalog.endpoints),
    offerings: byId(catalog.offerings),
    names: byId(catalog.names),
    agents: byId(catalog.agents)
  };
};
