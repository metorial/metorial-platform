import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  detectUploadedSkillFileFormat,
  extractSkillArchive,
  normalizeUploadedSkillFile
} from './archive';
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

  it('preserves a root SKILL.md when it is the only archive entry', async () => {
    let zip = new JSZip();
    zip.file('SKILL.md', '# Root skill');

    let files = await extractSkillArchive(await zip.generateAsync({ type: 'uint8array' }));
    expect(files.map(file => file.path)).toEqual(['/SKILL.md']);
    expect(Buffer.from(files[0]!.content).toString('utf8')).toBe('# Root skill');
  });

  it('detects uploaded ZIP and Markdown files', () => {
    expect(
      detectUploadedSkillFileFormat({
        fileName: 'skills.zip',
        fileType: 'application/octet-stream'
      })
    ).toBe('zip');
    expect(
      detectUploadedSkillFileFormat({
        fileName: 'instructions',
        fileType: 'text/markdown; charset=utf-8'
      })
    ).toBe('markdown');
    expect(
      detectUploadedSkillFileFormat({
        fileName: 'skill.json',
        fileType: 'application/json'
      })
    ).toBeNull();
  });

  it('normalizes an uploaded Markdown file as the root skill document', async () => {
    let content = new TextEncoder().encode('---\nname: Uploaded\n---\n# Uploaded');
    await expect(normalizeUploadedSkillFile({ format: 'markdown', content })).resolves.toEqual([
      {
        path: '/SKILL.md',
        content
      }
    ]);
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
