import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readBody, readNdjsonLines } from '../src/body';
import { parseIngestRequest } from '../src/parse';
import { matchRoute } from '../src/router';

let definitionFor = (method: string, path: string) => {
  let match = matchRoute(method, path);
  if (match.type != 'match') throw new Error('route missing');

  return match;
};

let parse = (
  path: string,
  headers: Record<string, string>,
  body: Uint8Array<ArrayBuffer> | string
) => {
  let match = definitionFor('POST', path);
  let request = new Request(`http://localhost${path}`, { method: 'POST', headers, body });
  let parsed = parseIngestRequest(request, match.definition, match.params);

  if (parsed instanceof Response) throw new Error('request rejected');

  return parsed;
};

describe('parseIngestRequest body', () => {
  it('exposes a decompressed body for gzip requests', async () => {
    let parsed = parse(
      '/v1/logs',
      { 'content-type': 'application/json', 'content-encoding': 'gzip' },
      new Uint8Array(gzipSync('{"hello":"world"}')) as Uint8Array<ArrayBuffer>
    );

    expect(parsed.contentEncoding).toBe('gzip');
    expect(new TextDecoder().decode(await readBody(parsed.body))).toBe('{"hello":"world"}');
  });

  it('exposes a null body when the request has none', () => {
    let match = definitionFor('POST', '/v1/logs');
    let request = new Request('http://localhost/v1/logs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    });
    let parsed = parseIngestRequest(request, match.definition, match.params);

    expect(parsed instanceof Response).toBe(false);
    if (parsed instanceof Response) return;

    expect(parsed.body).toBeNull();
  });

  it('streams bulk uploads line by line', async () => {
    let parsed = parse(
      '/v1/bulk',
      { 'content-type': 'application/x-ndjson', 'content-encoding': 'gzip' },
      new Uint8Array(gzipSync('{"h":1}\n{"i":1}\n'))
    );
    let lines: string[] = [];

    for await (let line of readNdjsonLines(parsed.body)) lines.push(line);

    expect(lines).toEqual(['{"h":1}', '{"i":1}']);
  });
});
