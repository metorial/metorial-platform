import { describe, expect, it } from 'vitest';
import { describeUploadDirectory, partitionUploads, summarizeNames } from './upload';

let file = (name: string) => new File(['x'], name);

describe('partitionUploads', () => {
  it('splits files into new and conflicting by name', () => {
    let { fresh, conflicting } = partitionUploads(
      [file('a.txt'), file('b.txt'), file('c.txt')],
      [{ name: 'b.txt' }, { name: 'other' }]
    );

    expect(fresh.map(f => f.name)).toEqual(['a.txt', 'c.txt']);
    expect(conflicting.map(f => f.name)).toEqual(['b.txt']);
  });

  it('treats names as case-sensitive', () => {
    let { fresh, conflicting } = partitionUploads([file('A.txt')], [{ name: 'a.txt' }]);

    expect(fresh).toHaveLength(1);
    expect(conflicting).toHaveLength(0);
  });
});

describe('describeUploadDirectory', () => {
  it('returns the directory when every item shares it', () => {
    expect(
      describeUploadDirectory([
        { meta: { directory: '/app' } },
        { meta: { directory: '/app' } }
      ])
    ).toBe('/app');
  });

  it('returns null for mixed or missing directories', () => {
    expect(
      describeUploadDirectory([{ meta: { directory: '/a' } }, { meta: { directory: '/b' } }])
    ).toBeNull();

    expect(describeUploadDirectory([])).toBeNull();
  });
});

describe('summarizeNames', () => {
  it('lists a few names and counts the rest', () => {
    expect(summarizeNames(['a', 'b'])).toBe('a, b');
    expect(summarizeNames(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c and 2 more');
  });
});
