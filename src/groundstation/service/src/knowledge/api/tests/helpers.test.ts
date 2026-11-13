import { describe, expect, it } from 'vitest';
import type { KnowledgeModel } from '../../../../prisma/generated/client';
import { sortByVersion } from '../knowledgeFamily';
import { likePattern } from '../keyset';

let model = (id: string, versionSort: number[], releaseDate: string | null = null) =>
  ({
    id,
    releaseDate: releaseDate ? new Date(releaseDate) : null,
    data: { versionSort }
  }) as unknown as KnowledgeModel;

describe('sortByVersion', () => {
  it('orders models newest version first, then by release date and id', () => {
    let models = [
      model('a-2', [2]),
      model('a-3', [3]),
      model('a-2-1', [2, 1]),
      model('a-10', [10]),
      model('b-unversioned', [], '2026-01-01'),
      model('a-unversioned', [], '2026-01-01'),
      model('old-unversioned', [], '2020-01-01')
    ];

    expect(sortByVersion(models).map(item => item.id)).toEqual([
      'a-10',
      'a-3',
      'a-2-1',
      'a-2',
      'a-unversioned',
      'b-unversioned',
      'old-unversioned'
    ]);
  });
});

describe('likePattern', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(likePattern('large')).toBe('%large%');
    expect(likePattern('100%_\\')).toBe('%100\\%\\_\\\\%');
  });
});
