import { readFile, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

let maxCacheBytes = 64 * 1024 * 1024;
let maxCacheEntries = 128;
let compressBrotli = promisify(brotliCompress);
let compressGzip = promisify(gzip);

type Encoding = 'br' | 'gzip' | 'identity';

type CacheEntry = { data: Promise<Buffer>; bytes: number };

let cache = new Map<string, CacheEntry>();
let cacheBytes = 0;

let selectEncoding = (header: string | null, compressible: boolean) => {
  let qualities = new Map<string, number>();
  for (let part of (header ?? '').split(',')) {
    let [name = '', ...parameters] = part
      .trim()
      .toLowerCase()
      .split(';')
      .map(value => value.trim());
    let value = parameters.find(parameter => parameter.trim().startsWith('q='));
    let quality = value ? Number(value.trim().slice(2)) : 1;

    qualities.set(name, quality >= 0 && quality <= 1 ? quality : 0);
  }

  let quality = (encoding: Encoding) =>
    qualities.get(encoding) ??
    (encoding === 'identity' ? (qualities.get('*') === 0 ? 0 : 1) : (qualities.get('*') ?? 0));
  let encodings: Encoding[] = compressible ? ['br', 'gzip', 'identity'] : ['identity'];

  return encodings
    .filter(encoding => quality(encoding) > 0)
    .sort((a, b) => quality(b) - quality(a))[0];
};

let getAsset = (filePath: string, version: string, encoding: Encoding) => {
  let key = `${filePath}:${version}:${encoding}`;
  let cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached.data;
  }

  let entry: CacheEntry = {
    bytes: 0,
    data: readFile(filePath).then(async data => {
      if (encoding === 'br') {
        return compressBrotli(data, {
          params: { [constants.BROTLI_PARAM_QUALITY]: 4 }
        });
      }
      if (encoding === 'gzip') return compressGzip(data);
      return data;
    })
  };
  cache.set(key, entry);

  entry.data = entry.data.then(
    data => {
      if (cache.get(key) === entry) {
        entry.bytes = data.byteLength;
        cacheBytes += entry.bytes;

        while (cacheBytes > maxCacheBytes || cache.size > maxCacheEntries) {
          let oldest = cache.entries().next().value;
          if (!oldest) break;
          cacheBytes -= oldest[1].bytes;
          cache.delete(oldest[0]);
        }
      }
      return data;
    },
    error => {
      if (cache.get(key) === entry) cache.delete(key);
      throw error;
    }
  );

  return entry.data;
};

export let createStaticAssetResponse = async (
  request: Request,
  filePath: string,
  options: { contentType: string; cacheControl?: string }
) => {
  let file = await stat(filePath);
  let compressible = /^(text\/|application\/(javascript|json|wasm)|image\/svg\+xml)/i.test(
    options.contentType
  );
  let encoding = selectEncoding(request.headers.get('accept-encoding'), compressible);
  let headers = new Headers({
    'Content-Type': options.contentType,
    'Cache-Control': options.cacheControl ?? 'public, max-age=31536000, immutable',
    Vary: 'Accept-Encoding'
  });
  if (!encoding) return new Response(null, { status: 406, headers });

  let data = await getAsset(filePath, `${file.mtimeMs}:${file.size}`, encoding);
  headers.set('Content-Length', String(data.byteLength));
  if (encoding !== 'identity') headers.set('Content-Encoding', encoding);

  return new Response(request.method === 'HEAD' ? null : new Uint8Array(data), { headers });
};
