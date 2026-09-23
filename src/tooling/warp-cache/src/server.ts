import type { ArtifactMetadata, Storage } from './storage';

type Config = {
  storage: Storage;
  token: string;
  team: string;
};

type Stats = {
  hits: number;
  misses: number;
  uploads: number;
  uploadBytes: number;
  errors: number;
  inFlightReads: number;
  inFlightUploads: number;
  inFlightQueries: number;
};

let hashPattern = /^[a-fA-F0-9]+$/;

function response(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status });
}

function metadataHeaders(metadata: ArtifactMetadata) {
  let headers = new Headers({ 'content-length': String(metadata.size) });
  if (metadata.duration !== undefined) headers.set('x-artifact-duration', String(metadata.duration));
  if (metadata.tag) headers.set('x-artifact-tag', metadata.tag);
  return headers;
}

export function createApp(config: Config) {
  let stats: Stats = { hits: 0, misses: 0, uploads: 0, uploadBytes: 0, errors: 0, inFlightReads: 0, inFlightUploads: 0, inFlightQueries: 0 };

  async function artifact(request: Request, hash: string) {
    if (!hashPattern.test(hash)) return response('invalid_hash', 'Artifact hash is invalid', 400);
    stats.inFlightReads += 1;
    let entry;
    try {
      entry = await config.storage.get(`v8/${config.team}/${hash}`);
    } finally {
      stats.inFlightReads -= 1;
    }
    if (!entry) {
      stats.misses += 1;
      return response('artifact_not_found', 'Artifact was not found', 404);
    }
    stats.hits += 1;
    let headers = metadataHeaders(entry.metadata);
    if (request.method === 'HEAD') return new Response(null, { headers });
    return new Response(entry.body, { headers });
  }

  return async function fetch(request: Request) {
    let url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ status: 'ready' });
    let pathname = url.pathname.replace(/^\/v8(?=\/|$)/, '');
    if (request.headers.get('authorization') !== `Bearer ${config.token}`) {
      return response('unauthorized', 'A valid bearer token is required', 401);
    }
    let team = url.searchParams.get('teamId') || url.searchParams.get('slug');
    if (team && team !== config.team) return response('forbidden', 'Team is not authorized', 403);
    if (request.method === 'GET' && pathname === '/artifacts/status') return Response.json({ status: 'enabled' });
    if (request.method === 'GET' && pathname === '/artifacts/stats') return Response.json(stats);
    if (request.method === 'POST' && pathname === '/artifacts/events') return new Response(null, { status: 200 });
    if (request.method === 'POST' && pathname === '/artifacts') {
      stats.inFlightQueries += 1;
      try {
        let body = (await request.json()) as { hashes?: string[] };
        if (!Array.isArray(body.hashes)) return response('invalid_request', 'hashes must be an array', 400);
        let entries: Record<string, unknown> = {};
        for (let offset = 0; offset < body.hashes.length; offset += 16) {
          await Promise.all(body.hashes.slice(offset, offset + 16).map(async hash => {
            if (!hashPattern.test(hash)) return;
            let key = `v8/${config.team}/${hash}`;
            let [exists, metadata] = await Promise.all([config.storage.exists(key), config.storage.metadata(key)]);
            entries[hash] = exists && metadata ? { size: metadata.size, taskDurationMs: metadata.duration || 0, tag: metadata.tag } : null;
            if (exists && metadata) stats.hits += 1;
            else stats.misses += 1;
          }));
        }
        return Response.json(entries);
      } finally {
        stats.inFlightQueries -= 1;
      }
    }
    let match = pathname.match(/^\/artifacts\/([a-fA-F0-9]+)$/);
    if (!match) return response('not_found', 'Route was not found', 404);
    if (request.method === 'HEAD' || request.method === 'GET') return artifact(request, match[1]);
    if (request.method !== 'PUT' || !request.body) return response('method_not_allowed', 'Method is not allowed', 405);
    let size = Number(request.headers.get('content-length'));
    if (!Number.isSafeInteger(size) || size < 0) return response('invalid_request', 'Content-Length is required', 400);
    let duration = request.headers.get('x-artifact-duration');
    let tag = request.headers.get('x-artifact-tag');
    try {
      stats.inFlightUploads += 1;
      await config.storage.put(`v8/${config.team}/${match[1]}`, request.body, {
        size,
        duration: duration ? Number(duration) : undefined,
        tag: tag || undefined
      });
      stats.uploads += 1;
      stats.uploadBytes += size;
    } catch (error) {
      stats.errors += 1;
      throw error;
    } finally {
      stats.inFlightUploads -= 1;
    }
    return Response.json({ urls: [] }, { status: 200 });
  };
}
