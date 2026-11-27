import { describe, expect, it } from 'vitest';
import { createStaticLogSource, paginateLogLines } from './staticSource';

let lines = [0, 1, 2, 5, 6, 9].map(index => ({ index, text: `line ${index}` }));
let indexes = (result: { lines: { index: number }[] }) => result.lines.map(line => line.index);

describe('paginateLogLines', () => {
  it('reads the newest lines backward when there is no cursor', () => {
    let result = paginateLogLines(lines, { direction: 'backward', limit: 2 });

    expect(indexes(result)).toEqual([6, 9]);
    expect(result.hasMore).toBe(true);
  });

  it('reads lines before the cursor backward', () => {
    expect(
      indexes(paginateLogLines(lines, { direction: 'backward', cursor: 5, limit: 2 }))
    ).toEqual([1, 2]);

    let result = paginateLogLines(lines, { direction: 'backward', cursor: 2, limit: 5 });
    expect(indexes(result)).toEqual([0, 1]);
    expect(result.hasMore).toBe(false);
  });

  it('reads lines from the cursor forward', () => {
    let first = paginateLogLines(lines, { direction: 'forward', limit: 3 });
    expect(indexes(first)).toEqual([0, 1, 2]);
    expect(first.hasMore).toBe(true);

    let rest = paginateLogLines(lines, { direction: 'forward', cursor: 3, limit: 10 });
    expect(indexes(rest)).toEqual([5, 6, 9]);
    expect(rest.hasMore).toBe(false);
  });
});

describe('createStaticLogSource', () => {
  it('indexes plain strings and reports a sealed log', async () => {
    let source = createStaticLogSource(['a', 'b', 'c']);
    let page = await source.fetch({ direction: 'backward', limit: 2 });

    expect(page).toMatchObject({
      lines: [
        { index: 1, text: 'b' },
        { index: 2, text: 'c' }
      ],
      hasMore: true,
      status: 'sealed',
      lineCount: 3
    });
  });
});
