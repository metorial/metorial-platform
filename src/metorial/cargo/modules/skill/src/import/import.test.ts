import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { discoverSkillPaths, getRelativeSkillPath, shouldImportSkillPath } from './discovery';
import {
  extractRepositoryArchive,
  getPublicRepositoryArchiveUrl,
  parsePublicRepositoryUrl
} from './publicRepository';

describe('skill repository imports', () => {
  it('parses supported public repository URLs and builds archive URLs', () => {
    expect(parsePublicRepositoryUrl('https://github.com/metorial/example.git')).toEqual({
      provider: 'github',
      owner: 'metorial',
      repository: 'example'
    });
    expect(parsePublicRepositoryUrl('https://gitlab.com/group/subgroup/example')).toEqual({
      provider: 'gitlab',
      owner: 'group/subgroup',
      repository: 'example'
    });
    expect(parsePublicRepositoryUrl('https://bitbucket.org/workspace/example')).toEqual({
      provider: 'bitbucket',
      owner: 'workspace',
      repository: 'example'
    });

    expect(
      getPublicRepositoryArchiveUrl(
        { provider: 'github', owner: 'metorial', repository: 'example' },
        'feature/import'
      )
    ).toBe('https://codeload.github.com/metorial/example/zip/feature%2Fimport');
    expect(
      getPublicRepositoryArchiveUrl({
        provider: 'gitlab',
        owner: 'group/subgroup',
        repository: 'example'
      })
    ).toBe(
      'https://gitlab.com/api/v4/projects/group%2Fsubgroup%2Fexample/repository/archive.zip?sha=HEAD'
    );
  });

  it('rejects unsupported hosts, credentials, and non-root provider URLs', () => {
    expect(() => parsePublicRepositoryUrl('https://example.com/owner/repo')).toThrow(
      'Only public GitHub'
    );
    expect(() => parsePublicRepositoryUrl('https://token@github.com/owner/repo')).toThrow(
      'without credentials'
    );
    expect(() => parsePublicRepositoryUrl('https://github.com/owner/repo/tree/main')).toThrow(
      'repository root'
    );
  });

  it('strips the archive wrapper directory', async () => {
    let zip = new JSZip();
    zip.file('example-main/skills/one/SKILL.md', '# One');
    zip.file('example-main/skills/one/assets/image.png', new Uint8Array([1, 2, 3]));

    let files = await extractRepositoryArchive(
      await zip.generateAsync({ type: 'uint8array' })
    );
    expect(files.map(file => file.path)).toEqual([
      '/skills/one/SKILL.md',
      '/skills/one/assets/image.png'
    ]);
  });

  it('rejects archive path traversal', async () => {
    let zip = new JSZip();
    zip.file('../outside/SKILL.md', '# Unsafe');

    await expect(
      extractRepositoryArchive(await zip.generateAsync({ type: 'uint8array' }))
    ).rejects.toThrow('unsafe path');
  });

  it('discovers case-insensitive skill roots and prunes nested skills', () => {
    expect(
      discoverSkillPaths([
        '/skills/one/skill.md',
        '/skills/one/nested/SKILL.md',
        '/skills/two/Skill.Md',
        '/README.md'
      ])
    ).toEqual(['/skills/one', '/skills/two']);
    expect(discoverSkillPaths(['/SKILL.md', '/skills/one/SKILL.md'])).toEqual(['/']);
  });

  it('rejects ambiguous skill document case variants', () => {
    expect(() => discoverSkillPaths(['/one/SKILL.md', '/one/skill.md'])).toThrow(
      'Multiple case variants'
    );
  });

  it('normalizes root skill documents and filters non-markdown agent files', () => {
    expect(getRelativeSkillPath('/skills/one', '/skills/one/skill.md')).toBe('/SKILL.md');
    expect(getRelativeSkillPath('/skills/one', '/skills/one/docs/readme.md')).toBe(
      '/docs/readme.md'
    );
    expect(shouldImportSkillPath('/agents/reviewer.md')).toBe(true);
    expect(shouldImportSkillPath('/agents/tool.js')).toBe(false);
    expect(shouldImportSkillPath('/agents/nested/reviewer.md')).toBe(false);
    expect(shouldImportSkillPath('/assets/tool.js')).toBe(true);
  });
});
