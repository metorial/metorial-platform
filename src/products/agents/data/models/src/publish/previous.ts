import { v } from '@lowerdeck/validation';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseWith } from '../lib/validate';
import type { Catalog } from '../types';

let defaultTimeoutMs = 60_000;
let defaultMaxBytes = 32 * 1024 * 1024;
let defaultMaxRawBytes = 512 * 1024 * 1024;

let compressedName = 'catalog.json.gz';
let catalogFile = 'catalog.json';
let gzipMagic = [0x1f, 0x8b];

let entity = v.object({ id: v.string(), status: v.string() });

let historyEntity = v.object({ id: v.string(), history: v.array(v.any()) });

// Only what continuity reads to carry ids, first-seen times and target history forward.
let previousCatalogSchema = v.object({
  schemaVersion: v.literal(1),
  generatedAt: v.string(),
  sources: v.array(v.object({ kind: v.string() })),
  organizations: v.array(entity),
  families: v.array(entity),
  models: v.array(entity),
  releases: v.array(entity),
  pointers: v.array(historyEntity),
  vendors: v.array(entity),
  endpoints: v.array(entity),
  offerings: v.array(
    v.object({
      id: v.string(),
      status: v.string(),
      firstSeenAt: v.string(),
      pricing: v.nullable(v.object({}))
    })
  ),
  names: v.array(
    v.object({
      id: v.string(),
      status: v.string(),
      firstSeenAt: v.string(),
      history: v.array(v.any())
    })
  ),
  agents: v.array(v.object({ id: v.string() }))
});

export interface FetchPreviousOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  maxRawBytes?: number;
}

export type PreviousCatalogResult =
  { ok: true; catalog: Catalog; json: string } | { ok: false; reason: string };

let readCapped = async (response: Response, maxBytes: number) => {
  let declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new Error(`response is ${declared} bytes, over ${maxBytes}`);
  if (!response.body) return Buffer.alloc(0);

  let chunks: Uint8Array[] = [];
  let total = 0;
  let reader = response.body.getReader();

  while (true) {
    let chunk = await reader.read();
    if (chunk.done) break;

    total += chunk.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`response is over ${maxBytes} bytes`);
    }
    chunks.push(chunk.value);
  }

  return Buffer.concat(chunks);
};

// Any failure means "no previous catalog"; the deploy gate then stops the publish.
export let fetchPreviousCatalog = async (
  siteUrl: string,
  opts: FetchPreviousOptions = {}
): Promise<PreviousCatalogResult> => {
  let timeoutMs = opts.timeoutMs ?? defaultTimeoutMs;
  let url = `${siteUrl.replace(/\/$/, '')}/${compressedName}?t=${Date.now()}`;

  try {
    let response = await (opts.fetch ?? fetch)(url, {
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status} from ${url}` };

    let body = await readCapped(response, opts.maxBytes ?? defaultMaxBytes);
    let isGzip = gzipMagic.every((byte, index) => body[index] === byte);
    let json = (
      isGzip
        ? gunzipSync(body, { maxOutputLength: opts.maxRawBytes ?? defaultMaxRawBytes })
        : body
    ).toString('utf8');

    let catalog = JSON.parse(json) as unknown;
    parseWith(previousCatalogSchema, catalog, 'previous catalog');
    if (!(catalog as Catalog).offerings.length)
      return { ok: false, reason: 'previous catalog has no offerings' };

    return { ok: true, catalog: catalog as Catalog, json };
  } catch (error) {
    if (!(error instanceof Error)) return { ok: false, reason: String(error) };
    if (error.name === 'TimeoutError')
      return { ok: false, reason: `timed out after ${timeoutMs}ms` };
    return { ok: false, reason: error.message };
  }
};

export let restorePreviousCatalog = async (opts: {
  siteUrl: string;
  dir: string;
  fetchOptions?: FetchPreviousOptions;
}) => {
  let file = path.join(opts.dir, catalogFile);
  if (existsSync(file)) return { status: 'present' as const, file };

  let result = await fetchPreviousCatalog(opts.siteUrl, opts.fetchOptions);
  if (!result.ok) return { status: 'missing' as const, reason: result.reason };

  await mkdir(opts.dir, { recursive: true });
  await writeFile(file, result.json);

  return {
    status: 'restored' as const,
    file,
    generatedAt: result.catalog.generatedAt,
    offerings: result.catalog.offerings.length
  };
};
