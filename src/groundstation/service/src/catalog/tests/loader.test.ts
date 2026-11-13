import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCatalogLoader, readCatalog } from '../loader';
import { fixtureCatalog } from './fixture';

let hourMs = 60 * 60 * 1000;
let minuteMs = 60 * 1000;

let silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

let flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('createCatalogLoader', () => {
  it('returns no catalog when none is configured', async () => {
    let read = vi.fn();
    let loader = createCatalogLoader({ location: undefined, read });

    expect(await loader.get()).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('keeps the catalog in memory and refreshes it hourly', async () => {
    let time = 0;
    let read = vi.fn(async () => fixtureCatalog);
    let loader = createCatalogLoader({ location: 'catalog.json', read, now: () => time });

    let first = await loader.get();
    expect(first?.generatedAt).toBe(fixtureCatalog.generatedAt);

    time = 30 * minuteMs;
    await loader.get();
    expect(read).toHaveBeenCalledTimes(1);

    time = hourMs + 1;
    await loader.get();
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps the last good catalog when a refresh fails', async () => {
    let warn = silenceWarnings();
    let time = 0;
    let read = vi.fn(async () => fixtureCatalog);
    let loader = createCatalogLoader({ location: 'catalog.json', read, now: () => time });

    let first = await loader.get();

    read.mockRejectedValueOnce(new Error('unreachable'));
    time = hourMs + 1;
    expect(await loader.get()).toBe(first);
    await flush();

    time += minuteMs;
    expect(await loader.get()).toBe(first);
    await flush();
    expect(read).toHaveBeenCalledTimes(2);

    warn.mockRestore();
  });

  it('retries a failed first load after a few minutes', async () => {
    let warn = silenceWarnings();
    let time = 0;
    let read = vi
      .fn(async () => fixtureCatalog)
      .mockRejectedValueOnce(new Error('unreachable'));
    let loader = createCatalogLoader({ location: 'catalog.json', read, now: () => time });

    expect(await loader.get()).toBeNull();

    time = minuteMs;
    expect(await loader.get()).toBeNull();

    time = 5 * minuteMs;
    expect((await loader.get())?.generatedAt).toBe(fixtureCatalog.generatedAt);
    expect(read).toHaveBeenCalledTimes(2);

    warn.mockRestore();
  });
});

describe('readCatalog', () => {
  it('reads a catalog file', async () => {
    let dir = await mkdtemp(join(tmpdir(), 'gs-catalog-'));
    let file = join(dir, 'catalog.json');
    await writeFile(file, JSON.stringify(fixtureCatalog));

    expect((await readCatalog(file)).generatedAt).toBe(fixtureCatalog.generatedAt);
    expect((await readCatalog(`file://${file}`)).offerings).toHaveLength(
      fixtureCatalog.offerings.length
    );
  });

  it('rejects files that are not a catalog', async () => {
    let dir = await mkdtemp(join(tmpdir(), 'gs-catalog-'));
    let file = join(dir, 'catalog.json');
    await writeFile(file, JSON.stringify({ schemaVersion: 2 }));

    await expect(readCatalog(file)).rejects.toThrow('unexpected shape');
  });
});
