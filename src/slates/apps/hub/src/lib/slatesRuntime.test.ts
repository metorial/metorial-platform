import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { fetchSlatesRuntime } from './slatesRuntime';

let response = (status: number, body: unknown) => ({
  status,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  arrayBuffer: async () => Uint8Array.from(body as Buffer).buffer as ArrayBuffer
});

let createRuntimeZip = async () => {
  let zip = new JSZip();
  zip.file('runtime.json', '{}');
  zip.file('index.js', 'module.exports = {};');

  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
};

let createClient = (d: {
  resolve: ReturnType<typeof response>;
  download?: ReturnType<typeof response>;
}) => {
  let resolve = vi.fn(async () => d.resolve);
  let download = vi.fn(async () => d.download ?? response(500, 'unexpected'));

  return {
    resolve,
    download,
    client: {
      tooling: {
        ':kind': { resolve: { $get: resolve }, ':version': { download: { $get: download } } }
      }
    }
  };
};

describe('fetchSlatesRuntime', () => {
  it('resolves the newest runtime for the hub protocol and unzips it', async () => {
    let { client, resolve, download } = createClient({
      resolve: response(200, { version: '1.4.0', main: 'index.js' }),
      download: response(200, await createRuntimeZip())
    });

    let runtime = await fetchSlatesRuntime({ client, downloadQuery: { proxy: 'true' } });

    expect(resolve).toHaveBeenCalledWith({
      param: { kind: 'slates-runtime' },
      query: { protocol: 'slates@2026-01-01' }
    });
    expect(download).toHaveBeenCalledWith({
      param: { kind: 'slates-runtime', version: '1.4.0' },
      query: { proxy: 'true' }
    });
    expect(runtime?.version).toBe('1.4.0');
    expect(runtime?.files.map(file => file.path).sort()).toEqual(['index.js', 'runtime.json']);
  });

  it('falls back when the registry has no runtime or fails', async () => {
    expect(
      await fetchSlatesRuntime(createClient({ resolve: response(404, 'not found') }))
    ).toBeNull();
    expect(
      await fetchSlatesRuntime(createClient({ resolve: response(502, 'bad gateway') }))
    ).toBeNull();
    expect(
      await fetchSlatesRuntime(
        createClient({
          resolve: response(200, { version: '1.4.0', main: 'index.js' }),
          download: response(500, 'storage down')
        })
      )
    ).toBeNull();
  });

  it('fails when a pinned runtime cannot be resolved', async () => {
    let { client, resolve } = createClient({ resolve: response(404, 'not found') });

    await expect(fetchSlatesRuntime({ client, pinnedVersion: '1.2.0' })).rejects.toThrow(
      'Could not get slates runtime 1.2.0'
    );
    expect(resolve).toHaveBeenCalledWith({
      param: { kind: 'slates-runtime' },
      query: { protocol: 'slates@2026-01-01', version: '1.2.0' }
    });
  });
});
