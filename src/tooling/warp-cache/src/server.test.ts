import { expect, test } from 'bun:test';
import { createApp } from './server';
import { FileStorage, MemoryStorage } from './storage';

let token = 'test-token';
let app = createApp({ storage: new MemoryStorage(), token, team: 'metorial' });
let headers = { authorization: `Bearer ${token}` };

test('stores, queries, and restores an artifact', async () => {
  let hash = 'a1b2c3';
  let upload = await app(
    new Request(`http://cache/artifacts/${hash}?teamId=metorial`, {
      method: 'PUT',
      headers: { ...headers, 'content-length': '5', 'x-artifact-duration': '7', 'x-artifact-tag': 'tag' },
      body: 'hello'
    })
  );
  expect(upload.status).toBe(200);
  let head = await app(new Request(`http://cache/artifacts/${hash}?slug=metorial`, { method: 'HEAD', headers }));
  expect(head.headers.get('x-artifact-duration')).toBe('7');
  let download = await app(new Request(`http://cache/artifacts/${hash}`, { headers }));
  expect(await download.text()).toBe('hello');
  let query = await app(new Request('http://cache/artifacts', { method: 'POST', headers, body: JSON.stringify({ hashes: [hash, 'ffffff'] }) }));
  expect(await query.json()).toEqual({ [hash]: { size: 5, taskDurationMs: 7, tag: 'tag' }, ffffff: null });
});

test('rejects an unauthorized request', async () => {
  let result = await app(new Request('http://cache/artifacts/status'));
  expect(result.status).toBe(401);
});

test('reports aggregate cache activity without artifact details', async () => {
  let hash = 'd4e5f6';
  await app(new Request(`http://cache/artifacts/${hash}`, { headers }));
  let stats = await app(new Request('http://cache/artifacts/stats', { headers }));
  expect(await stats.json()).toMatchObject({ hits: expect.any(Number), misses: expect.any(Number), uploads: expect.any(Number), uploadBytes: expect.any(Number), errors: expect.any(Number), inFlightReads: 0, inFlightUploads: 0, inFlightQueries: 0 });
});

test('filesystem storage preserves streamed artifact bodies', async () => {
  let storage = new FileStorage(`/tmp/warp-cache-test-${crypto.randomUUID()}`);
  await storage.put('v8/metorial/abc123', new Blob(['artifact']).stream(), { size: 8 });
  let artifact = await storage.get('v8/metorial/abc123');
  expect(await new Response(artifact?.body).text()).toBe('artifact');
});

test('treats an artifact without committed metadata as a cache miss', async () => {
  let storage = new FileStorage(`/tmp/warp-cache-test-${crypto.randomUUID()}`);
  let key = 'v8/metorial/abc123';
  await Bun.write(storage.artifactPath(key), 'partial');
  expect(await storage.get(key)).toBeNull();
});
