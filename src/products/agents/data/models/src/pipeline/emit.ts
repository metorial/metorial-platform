import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { groupBy } from '../lib/util';
import { sourceSnapshotPath } from '../sources/fetch';
import type { Catalog, SourceKind } from '../types';
import type { BuildResult } from './build';
import type { DeployGate } from './gate';
import { renderReport } from './report';

let generatedEntries = [
  'catalog.json',
  'organizations.json',
  'families.json',
  'models.json',
  'vendors.json',
  'offerings.json',
  'names.json',
  'agents.json',
  'unresolved.json',
  'issues.json',
  'report.md',
  'organizations',
  'families',
  'models',
  'vendors',
  'agents',
  'logos',
  'sources'
];

let writeJson = async (file: string, value: unknown, compact = false) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `${compact ? JSON.stringify(value) : JSON.stringify(value, null, 2)}\n`
  );
};

let unresolvedSummary = (catalog: Catalog) => {
  let offerings = catalog.offerings.filter(
    offering => offering.status !== 'retired' && offering.resolution.method === 'unresolved'
  );
  let names = catalog.names.filter(
    name => name.status === 'live' && name.target.kind === 'unresolved'
  );

  return {
    offerings: Object.fromEntries(
      [...groupBy(offerings, offering => offering.vendorId)].map(([vendorId, items]) => [
        vendorId,
        items.map(item => item.vendorModelId).sort()
      ])
    ),
    names: Object.fromEntries(
      [...groupBy(names, name => name.namespace)].map(([namespace, items]) => [
        namespace,
        items.map(item => item.raw).sort()
      ])
    )
  };
};

// Each entity also gets its own file so consumers can fetch one model or vendor without the
// whole catalog; ids with a slash become nested directories.
let writeEntityFiles = async (dir: string, catalog: Catalog) => {
  let offeringsByModel = groupBy(
    catalog.offerings.filter(offering => offering.modelId),
    offering => offering.modelId!
  );
  let offeringsByVendor = groupBy(catalog.offerings, offering => offering.vendorId);
  let releasesByModel = groupBy(catalog.releases, release => release.modelId);
  let modelsById = new Map(catalog.models.map(model => [model.id, model]));
  let writes: Promise<void>[] = [];

  for (let organization of catalog.organizations)
    writes.push(
      writeJson(path.join(dir, 'organizations', `${organization.id}.json`), organization)
    );

  for (let family of catalog.families)
    writes.push(
      writeJson(path.join(dir, 'families', `${family.id}.json`), {
        ...family,
        models: family.modelIds.map(id => modelsById.get(id)).filter(Boolean)
      })
    );

  for (let model of catalog.models)
    writes.push(
      writeJson(path.join(dir, 'models', `${model.id}.json`), {
        ...model,
        releases: releasesByModel.get(model.id) ?? [],
        offerings: offeringsByModel.get(model.id) ?? []
      })
    );

  for (let vendor of catalog.vendors)
    writes.push(
      writeJson(path.join(dir, 'vendors', `${vendor.id}.json`), {
        ...vendor,
        endpoints: catalog.endpoints.filter(endpoint => endpoint.vendorId === vendor.id),
        offerings: offeringsByVendor.get(vendor.id) ?? []
      })
    );

  let organizationsById = new Map(catalog.organizations.map(org => [org.id, org]));
  let vendorsById = new Map(catalog.vendors.map(vendor => [vendor.id, vendor]));

  for (let agent of catalog.agents)
    writes.push(
      writeJson(path.join(dir, 'agents', `${agent.id}.json`), {
        ...agent,
        maker: organizationsById.get(agent.makerId) ?? null,
        vendors: agent.vendors.map(link => ({
          ...link,
          vendor: vendorsById.get(link.vendorId) ?? null
        }))
      })
    );

  await Promise.all(writes);
};

export let emitCatalog = async (dir: string, result: BuildResult, gate?: DeployGate) => {
  let { catalog } = result;

  await mkdir(dir, { recursive: true });
  for (let entry of generatedEntries)
    await rm(path.join(dir, entry), { recursive: true, force: true });

  await writeJson(path.join(dir, 'catalog.json'), catalog, true);
  await writeJson(path.join(dir, 'organizations.json'), catalog.organizations);
  await writeJson(path.join(dir, 'families.json'), catalog.families);
  await writeJson(path.join(dir, 'models.json'), {
    models: catalog.models,
    releases: catalog.releases,
    pointers: catalog.pointers
  });

  await writeJson(path.join(dir, 'vendors.json'), {
    vendors: catalog.vendors,
    endpoints: catalog.endpoints
  });
  await writeJson(path.join(dir, 'offerings.json'), catalog.offerings, true);
  await writeJson(path.join(dir, 'names.json'), catalog.names, true);
  await writeJson(path.join(dir, 'agents.json'), catalog.agents);
  await writeJson(path.join(dir, 'unresolved.json'), unresolvedSummary(catalog));
  await writeJson(path.join(dir, 'issues.json'), result.issues);

  await writeEntityFiles(dir, catalog);

  for (let [kind, raw] of result.rawSources)
    await writeJson(sourceSnapshotPath(dir, kind as SourceKind), raw, true);

  for (let [target, source] of result.logoSources) {
    let file = path.join(dir, target);
    await mkdir(path.dirname(file), { recursive: true });
    await copyFile(source, file);
  }

  await writeFile(path.join(dir, 'report.md'), renderReport(result, gate));
};
