import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { v } from '@lowerdeck/validation';
import type { Catalog } from '@metorial/model-catalog/src/types';

let gunzipAsync = promisify(gunzip);

export let supportedSchemaVersions = [1];

let catalogSchema = v.object({
  schemaVersion: v.number(),
  generatedAt: v.string(),
  organizations: v.array(v.object({ id: v.string() })),
  families: v.array(v.object({ id: v.string(), labId: v.string() })),
  models: v.array(v.object({ id: v.string(), labId: v.string() })),
  releases: v.array(v.object({ id: v.string(), modelId: v.string() })),
  pointers: v.array(v.object({ id: v.string(), labId: v.string() })),
  vendors: v.array(v.object({ id: v.string(), organizationId: v.string() })),
  endpoints: v.array(v.object({ id: v.string(), vendorId: v.string() })),
  offerings: v.array(
    v.object({ id: v.string(), vendorId: v.string(), vendorModelId: v.string() })
  ),
  names: v.array(v.object({ id: v.string(), raw: v.string(), key: v.string() })),
  agents: v.optional(v.array(v.object({ id: v.string(), makerId: v.string() })))
});

export let parseArchive = async (archive: Buffer): Promise<Catalog> => {
  let parsed = JSON.parse((await gunzipAsync(archive)).toString('utf8'));

  let validated = catalogSchema.validate(parsed);
  if (!validated.success)
    throw new Error('The model knowledge catalog has an unexpected shape.');

  return { ...parsed, agents: parsed.agents ?? [] } as Catalog;
};
