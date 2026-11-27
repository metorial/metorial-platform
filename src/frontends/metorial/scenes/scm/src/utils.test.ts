import { describe, expect, it } from 'vitest';
import { parsePublicScmRepositoryUrl } from './utils';

describe('parsePublicScmRepositoryUrl', () => {
  it.each([
    [
      'https://github.com/metorial/metorial.git/',
      {
        provider: 'github',
        identifier: 'metorial/metorial',
        url: 'https://github.com/metorial/metorial'
      }
    ],
    [
      'http://gitlab.com/metorial/platform/skills',
      {
        provider: 'gitlab',
        identifier: 'metorial/platform/skills',
        url: 'https://gitlab.com/metorial/platform/skills'
      }
    ],
    [
      'https://bitbucket.org/metorial/skills',
      {
        provider: 'bitbucket',
        identifier: 'metorial/skills',
        url: 'https://bitbucket.org/metorial/skills'
      }
    ],
    [
      'github.com/metorial/skills',
      {
        provider: 'github',
        identifier: 'metorial/skills',
        url: 'https://github.com/metorial/skills'
      }
    ]
  ])('normalizes public repository URL %s', (value, expected) => {
    expect(parsePublicScmRepositoryUrl(value)).toEqual(expected);
  });

  it.each([
    'https://example.com/metorial/skills',
    'git@github.com:metorial/skills.git',
    'https://github.com/metorial/skills/tree/main',
    'https://gitlab.com/metorial/skills/-/tree/main',
    'https://bitbucket.org/metorial/skills/src/main',
    'https://github.com/metorial'
  ])('rejects non-repository URL %s', value => {
    expect(parsePublicScmRepositoryUrl(value)).toBeNull();
  });
});
