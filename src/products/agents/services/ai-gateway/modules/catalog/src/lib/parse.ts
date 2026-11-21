import { v } from '@lowerdeck/validation';
import type { Catalog } from '@mtsrc/ai-gateway-spec';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

let gunzipAsync = promisify(gunzip);

let supportedSchemaVersions = [1];

let catalogSchema = v.object({
  schemaVersion: v.number(),
  generatedAt: v.string(),
  organizations: v.array(v.object({ id: v.string() })),
  models: v.array(v.object({ id: v.string(), labId: v.string() })),
  pointers: v.array(v.object({ id: v.string(), labId: v.string() })),
  vendors: v.array(v.object({ id: v.string(), organizationId: v.string() })),
  offerings: v.array(
    v.object({ id: v.string(), vendorId: v.string(), vendorModelId: v.string() })
  ),
  names: v.array(v.object({ id: v.string(), raw: v.string(), key: v.string() }))
});

export let parseArchive = async (archive: Buffer): Promise<Catalog> => {
  let parsed = JSON.parse((await gunzipAsync(archive)).toString('utf8'));

  let validated = catalogSchema.validate(parsed);
  if (!validated.success) throw new Error('The model catalog has an unexpected shape.');

  if (!supportedSchemaVersions.includes(validated.value.schemaVersion)) {
    throw new Error(
      `The model catalog schema version ${validated.value.schemaVersion} is not supported.`
    );
  }

  return parsed as Catalog;
};
