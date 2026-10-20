import { beforeEach, describe, expect, it, vi } from 'vitest';

let openDB = vi.fn();

vi.mock('idb', () => ({ openDB: (...args: any[]) => openDB(...args) }));

let closingError = () =>
  Object.assign(new Error('The database connection is closing.'), {
    name: 'InvalidStateError'
  });

let createDb = (opts: { closing?: boolean; value?: string } = {}) => ({
  transaction: vi.fn(() => {
    if (opts.closing) throw closingError();
    return { objectStore: () => ({ get: async () => opts.value }) };
  })
});

describe('createObjectStorage', () => {
  beforeEach(() => {
    vi.resetModules();
    openDB.mockReset();
    // @ts-ignore
    globalThis.window = {};
  });

  it('reopens the database when the cached connection is closing', async () => {
    let closingDb = createDb({ closing: true });
    let freshDb = createDb({ value: 'fresh' });
    openDB.mockResolvedValueOnce(closingDb).mockResolvedValueOnce(freshDb);

    let { createObjectStorage } = await import('./index');
    let storage = createObjectStorage<string>('test');

    await expect(storage.get('key')).resolves.toBe('fresh');
    expect(openDB).toHaveBeenCalledTimes(2);
  });

  it('reopens the database after the browser terminates the connection', async () => {
    let firstDb = createDb({ value: 'first' });
    let secondDb = createDb({ value: 'second' });
    openDB.mockResolvedValueOnce(firstDb).mockResolvedValueOnce(secondDb);

    let { createObjectStorage } = await import('./index');
    let storage = createObjectStorage<string>('test');

    await expect(storage.get('key')).resolves.toBe('first');

    openDB.mock.calls[0][2].terminated();

    await expect(storage.get('key')).resolves.toBe('second');
    expect(openDB).toHaveBeenCalledTimes(2);
  });

  it('retries opening after a failed open', async () => {
    openDB
      .mockRejectedValueOnce(new Error('open failed'))
      .mockResolvedValueOnce(createDb({ value: 'ok' }));

    let { createObjectStorage } = await import('./index');
    let storage = createObjectStorage<string>('test');

    await expect(storage.get('key')).rejects.toThrow('open failed');
    await expect(storage.get('key')).resolves.toBe('ok');
  });

  it('rethrows unrelated transaction errors', async () => {
    let db = {
      transaction: vi.fn(() => {
        throw new Error('boom');
      })
    };
    openDB.mockResolvedValueOnce(db);

    let { createObjectStorage } = await import('./index');
    let storage = createObjectStorage<string>('test');

    await expect(storage.get('key')).rejects.toThrow('boom');
    expect(openDB).toHaveBeenCalledTimes(1);
  });
});
