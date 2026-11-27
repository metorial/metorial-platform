import { describe, expect, it, vi } from 'vitest';
import type { RequestScopedSkillSource } from '../lib/requestSkills';
import {
  createSkillMcpCatalog,
  parseSkillCursor,
  parseSkillUri,
  toSkillUri
} from './skillCatalog';

describe('skill URIs', () => {
  it('builds the SKILL.md and skill root URIs', () => {
    expect(toSkillUri('refunds', '/SKILL.md')).toBe('skill://refunds/SKILL.md');
    expect(toSkillUri('refunds', '')).toBe('skill://refunds');
  });

  it('percent-encodes path segments and decodes them back', () => {
    let uri = toSkillUri('refunds', '/references/Q&A notes.md');

    expect(uri).toBe('skill://refunds/references/Q%26A%20notes.md');
    expect(parseSkillUri(uri)).toEqual({
      skillName: 'refunds',
      path: '/references/Q&A notes.md'
    });
  });

  it('parses directory URIs with and without a trailing slash', () => {
    expect(parseSkillUri('skill://refunds')).toEqual({ skillName: 'refunds', path: '' });
    expect(parseSkillUri('skill://refunds/templates/')).toEqual({
      skillName: 'refunds',
      path: '/templates'
    });
  });

  it.each(['file://refunds/SKILL.md', 'skill://', 'skill://refunds/%E0%A4%A'])(
    'rejects %s',
    uri => {
      expect(parseSkillUri(uri)).toBeNull();
    }
  );
});

describe('parseSkillCursor', () => {
  it('starts at the first skill without a cursor', () => {
    expect(parseSkillCursor(undefined)).toBe(0);
    expect(parseSkillCursor('40')).toBe(40);
  });

  it.each(['-1', '1.5', 'abc'])('rejects %s', cursor => {
    expect(() => parseSkillCursor(cursor)).toThrow('Invalid cursor');
  });
});

let encoder = new TextEncoder();

let skillDocument = '---\nname: refunds\ndescription: Handle refunds\n---\n# Refunds\n';

let createSource = (overrides: Partial<RequestScopedSkillSource> = {}) =>
  ({
    listSkills: vi.fn(async () => [
      { id: 'sk_2', name: 'refunds' },
      { id: 'sk_1', name: 'billing' }
    ]),
    getSkillDocument: vi.fn(async () => ({
      frontmatter: { name: 'refunds', description: 'Handle refunds' },
      size: encoder.encode(skillDocument).byteLength
    })),
    listSkillFiles: vi.fn(async () => ({
      frontmatter: { name: 'refunds' },
      files: [
        { path: '/SKILL.md', mimeType: 'text/markdown', size: 10, sha256: 'a'.repeat(64) },
        {
          path: '/references/Q&A notes.md',
          mimeType: 'text/markdown',
          size: 20,
          sha256: 'b'.repeat(64)
        },
        {
          path: '/references/deep/table.csv',
          mimeType: 'text/csv',
          size: 30,
          sha256: 'c'.repeat(64)
        },
        { path: '/assets/logo.png', mimeType: 'image/png', size: 4, sha256: 'd'.repeat(64) }
      ]
    })),
    listSkillEntries: vi.fn(async () => [
      { path: '/SKILL.md', mimeType: 'text/markdown', size: 10 },
      { path: '/references/Q&A notes.md', mimeType: 'text/markdown', size: 20 },
      { path: '/references/deep/table.csv', mimeType: 'text/csv', size: 30 },
      { path: '/assets/logo.png', mimeType: 'image/png', size: 4 }
    ]),
    readSkillFile: vi.fn(async ({ path }: { path: string }) =>
      path === '/assets/logo.png'
        ? {
            path,
            mimeType: 'image/png',
            size: 4,
            text: null,
            bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47])
          }
        : {
            path,
            mimeType: 'text/markdown',
            size: encoder.encode(skillDocument).byteLength,
            text: skillDocument,
            bytes: encoder.encode(skillDocument)
          }
    ),
    ...overrides
  }) satisfies RequestScopedSkillSource;

describe('createSkillMcpCatalog', () => {
  it('lists skills by name with SEP-2640 entries and passes the spec limits', async () => {
    let source = createSource();
    let catalog = createSkillMcpCatalog(source);

    let page = await catalog.listSkills({});

    expect(page.nextCursor).toBeUndefined();
    expect(page.skills.map(skill => skill.uri)).toEqual([
      'skill://billing/SKILL.md',
      'skill://refunds/SKILL.md'
    ]);
    expect(page.skills[1]!.resources[1]).toEqual({
      uri: 'skill://refunds/references/Q%26A%20notes.md',
      digest: `sha256:${'b'.repeat(64)}`,
      size: 20
    });
    expect(source.listSkillFiles).toHaveBeenCalledWith({
      skillId: 'sk_2',
      limits: { maxFiles: 512, maxBytes: 16 * 1024 * 1024 }
    });
  });

  it('drops skills the source cannot serve and keeps the rest', async () => {
    let catalog = createSkillMcpCatalog(
      createSource({
        listSkillFiles: vi.fn(async ({ skillId }) =>
          skillId === 'sk_1' ? null : { frontmatter: {}, files: [] }
        )
      })
    );

    let page = await catalog.listSkills({});

    expect(page.skills.map(skill => skill.uri)).toEqual(['skill://refunds/SKILL.md']);
  });

  it('only resolves SKILL.md URIs of known skills in skills/get', async () => {
    let catalog = createSkillMcpCatalog(createSource());

    expect((await catalog.getSkill({ uri: 'skill://refunds/SKILL.md' }))?.uri).toBe(
      'skill://refunds/SKILL.md'
    );
    expect(await catalog.getSkill({ uri: 'skill://refunds/references' })).toBeNull();
    expect(await catalog.getSkill({ uri: 'skill://unknown/SKILL.md' })).toBeNull();
  });

  it('serves text as text and binary content as base64', async () => {
    let source = createSource();
    let catalog = createSkillMcpCatalog(source);

    expect(await catalog.readResource({ uri: 'skill://refunds/SKILL.md' })).toEqual({
      uri: 'skill://refunds/SKILL.md',
      mimeType: 'text/markdown',
      text: skillDocument
    });
    expect(await catalog.readResource({ uri: 'skill://refunds/assets/logo.png' })).toEqual({
      uri: 'skill://refunds/assets/logo.png',
      mimeType: 'image/png',
      blob: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')
    });
    expect(source.readSkillFile).toHaveBeenCalledWith(
      expect.objectContaining({ skillId: 'sk_2', path: '/assets/logo.png' })
    );
  });

  it('lists direct children of a directory without hashing the skill', async () => {
    let source = createSource();
    let catalog = createSkillMcpCatalog(source);

    expect(await catalog.readDirectory({ uri: 'skill://refunds/references/' })).toEqual({
      resources: [
        {
          uri: 'skill://refunds/references/Q%26A%20notes.md',
          name: 'Q&A notes.md',
          mimeType: 'text/markdown',
          size: 20
        },
        {
          uri: 'skill://refunds/references/deep',
          name: 'deep',
          mimeType: 'inode/directory'
        }
      ]
    });
    expect(await catalog.readDirectory({ uri: 'skill://refunds/missing' })).toBeNull();
    expect(source.listSkillFiles).not.toHaveBeenCalled();
  });

  it('pages SKILL.md documents for resources/list', async () => {
    let catalog = createSkillMcpCatalog(createSource());

    let page = await catalog.listSkillDocuments({ cursor: '1' });

    expect(page).toEqual({
      documents: [
        {
          uri: 'skill://refunds/SKILL.md',
          name: 'refunds',
          description: 'Handle refunds',
          size: encoder.encode(skillDocument).byteLength
        }
      ]
    });
  });
});
