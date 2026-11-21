import { describe, expect, it, vi } from 'vitest';
import { createBufferedWriter } from '../src/lib/bufferedWriter';

let writerWith = (write: (items: number[]) => Promise<void>, maxBuffered = 100) => {
  let onDrop = vi.fn();
  let writer = createBufferedWriter<number>({
    write,
    flushIntervalMs: 60_000,
    maxBatch: 3,
    maxBuffered,
    onDrop
  });

  return { writer, onDrop };
};

describe('createBufferedWriter', () => {
  it('writes in batches of at most maxBatch', async () => {
    let batches: number[][] = [];
    let { writer } = writerWith(async items => {
      batches.push(items);
    });

    for (let i = 1; i <= 7; i++) writer.push(i);
    await writer.close();

    expect(batches.flat()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(batches.every(batch => batch.length <= 3)).toBe(true);
  });

  it('retries a failed batch once and drops it if it fails again', async () => {
    let attempts = 0;
    let { writer, onDrop } = writerWith(async () => {
      attempts++;
      throw new Error('store down');
    });

    writer.push(1);
    await writer.flush();
    expect(writer.size).toBe(1);

    await writer.flush();
    expect(attempts).toBe(2);
    expect(writer.size).toBe(0);
    expect(onDrop).toHaveBeenCalledWith(1, 'write_failed', expect.any(Error));
  });

  it('keeps a batch that succeeds on retry', async () => {
    let written: number[] = [];
    let fail = true;
    let { writer, onDrop } = writerWith(async items => {
      if (fail) {
        fail = false;
        throw new Error('blip');
      }
      written.push(...items);
    });

    writer.push(1);
    await writer.flush();
    writer.push(2);
    await writer.flush();

    expect(written).toEqual([1, 2]);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('drops the oldest entries when the buffer overflows', async () => {
    let written: number[] = [];
    let release!: () => void;
    let blocked = new Promise<void>(resolve => (release = resolve));

    let { writer, onDrop } = writerWith(async items => {
      await blocked;
      written.push(...items);
    }, 4);

    for (let i = 1; i <= 3; i++) writer.push(i);
    for (let i = 4; i <= 9; i++) writer.push(i);

    release();
    await writer.close();

    expect(onDrop).toHaveBeenCalledWith(expect.any(Number), 'overflow');
    expect(written.slice(0, 3)).toEqual([1, 2, 3]);
    expect(written.slice(3)).toEqual([6, 7, 8, 9]);
  });
});
