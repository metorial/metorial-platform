import type { ArtifactMetadata, Storage } from './storage';

type Config = {
  storage: Storage;
  token: string;
  team: string;
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
  async function artifact(request: Request, hash: string) {
    if (!hashPattern.test(hash)) return response('invalid_hash', 'Artifact hash is invalid', 400);
    let entry = await config.storage.get(`v8/${config.team}/${hash}`);
    if (!entry) return response('artifact_not_found', 'Artifact was not found', 404);
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
    if (request.method === 'POST' && pathname === '/artifacts/events') return new Response(null, { status: 200 });
    if (request.method === 'POST' && pathname === '/artifacts') {
      let body = (await request.json()) as { hashes?: string[] };
      if (!Array.isArray(body.hashes)) return response('invalid_request', 'hashes must be an array', 400);
      let entries: Record<string, unknown> = {};
      for (let hash of body.hashes) {
        if (!hashPattern.test(hash)) continue;
        let entry = await config.storage.get(`v8/${config.team}/${hash}`);
        entries[hash] = entry ? { size: entry.metadata.size, taskDurationMs: entry.metadata.duration || 0, tag: entry.metadata.tag } : null;
      }
      return Response.json(entries);
    }
    let match = pathname.match(/^\/artifacts\/([a-fA-F0-9]+)$/);
    if (!match) return response('not_found', 'Route was not found', 404);
    if (request.method === 'HEAD' || request.method === 'GET') return artifact(request, match[1]);
    if (request.method !== 'PUT' || !request.body) return response('method_not_allowed', 'Method is not allowed', 405);
    let size = Number(request.headers.get('content-length'));
    if (!Number.isSafeInteger(size) || size < 0) return response('invalid_request', 'Content-Length is required', 400);
    let duration = request.headers.get('x-artifact-duration');
    let tag = request.headers.get('x-artifact-tag');
    await config.storage.put(`v8/${config.team}/${match[1]}`, request.body, {
      size,
      duration: duration ? Number(duration) : undefined,
      tag: tag || undefined
    });
    return Response.json({ urls: [] }, { status: 200 });
  };
}
