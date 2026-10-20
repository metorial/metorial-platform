import { describe, expect, it } from 'vitest';
import { SkippedContentError, WorkspaceLoadBudget } from './rules';
import { SkillStoreFs } from './skillStoreFs';

let createFs = (readOnly = false) => {
  let fs = new SkillStoreFs({ readOnly });
  fs.seed([
    { path: '/', kind: 'directory', itemId: 'root' },
    { path: '/SKILL.md', kind: 'document', itemId: 'skill', load: async () => '# Skill' },
    { path: '/docs/', kind: 'directory', itemId: 'docs' },
    { path: '/docs/guide.md', kind: 'document', itemId: 'guide', load: async () => 'Guide' },
    { path: '/scripts/run.sh', kind: 'file', itemId: 'run', load: async () => 'echo hi' }
  ]);
  return fs;
};

describe('SkillStoreFs', () => {
  it('lazily reads seeded content', async () => {
    let fs = createFs();
    expect(await fs.readFile('/docs/guide.md')).toBe('Guide');
    expect(await fs.collectChanges()).toEqual([]);
  });

  it('rejects writes when read-only', async () => {
    let fs = createFs(true);
    await expect(fs.writeFile('/new.md', 'x')).rejects.toThrow(/EROFS/);
    await expect(fs.rm('/docs/guide.md')).rejects.toThrow(/EROFS/);
  });

  it('protects SKILL.md and the agents directory', async () => {
    let fs = createFs();
    await expect(fs.rm('/SKILL.md')).rejects.toThrow(/EPERM/);
    await expect(fs.mv('/SKILL.md', '/OTHER.md')).rejects.toThrow(/EPERM/);
    await expect(fs.writeFile('/agents/tool.json', '{}')).rejects.toThrow(/EPERM/);
    await expect(fs.writeFile('/bad:name.md', 'x')).rejects.toThrow(/EINVAL/);
  });

  it('collects creates, modifications, moves and deletes', async () => {
    let fs = createFs();
    await fs.writeFile('/notes.md', 'Notes');
    await fs.writeFile('/SKILL.md', '# Skill\n\nUpdated');
    await fs.mv('/docs/guide.md', '/docs/handbook.md');
    await fs.rm('/scripts/run.sh');
    await fs.mkdir('/empty');

    let changes = await fs.collectChanges();
    expect(changes.map(change => [change.op, change.path])).toEqual([
      ['delete', '/scripts/run.sh'],
      ['modify', '/SKILL.md'],
      ['move', '/docs/handbook.md'],
      ['create', '/notes.md'],
      ['create', '/empty']
    ]);
  });

  it('reads skipped files as empty and refuses to build on them', async () => {
    let fs = new SkillStoreFs({ readOnly: false });
    let skip = async (): Promise<string> => {
      throw new SkippedContentError('/big.bin is 6.0 MB, over the 5.0 MB per-file limit');
    };
    fs.seed([
      { path: '/', kind: 'directory', itemId: 'root' },
      { path: '/big.bin', kind: 'file', itemId: 'big', size: 6_000_000, load: skip },
      { path: '/big.md', kind: 'document', itemId: 'bigdoc', size: 6_000_000, load: skip }
    ]);

    expect(await fs.readFile('/big.bin')).toBe('');
    expect((await fs.stat('/big.bin')).size).toBe(6_000_000);
    await expect(fs.writeFile('/big.bin', 'x')).rejects.toThrow(/EFBIG/);
    await expect(fs.appendFile('/big.md', 'x')).rejects.toThrow(/EFBIG/);
    await expect(fs.cp('/big.bin', '/copy.bin')).rejects.toThrow(/EFBIG/);
    expect(await fs.collectChanges()).toEqual([]);

    await fs.mv('/big.bin', '/moved.bin');
    expect((await fs.collectChanges()).map(change => change.op)).toEqual(['move']);
  });

  it('enforces the per-file and total load budget', () => {
    let budget = new WorkspaceLoadBudget({ file: 5, total: 8 });
    expect(() => budget.reserve('/a', 6)).toThrow(SkippedContentError);
    let release = budget.reserve('/b', 5);
    expect(() => budget.reserve('/c', 4)).toThrow(/limit/);
    release();
    expect(() => budget.reserve('/c', 4)).not.toThrow();
  });

  it('ignores writes that restore the original content', async () => {
    let fs = createFs();
    await fs.writeFile('/docs/guide.md', 'Guide');
    expect(await fs.collectChanges()).toEqual([]);
  });

  it('rebases after acknowledging and reverts failed changes', async () => {
    let fs = createFs();
    await fs.writeFile('/notes.md', 'Notes');
    await fs.rm('/docs/guide.md');

    let [remove, create] = await fs.collectChanges();
    await fs.acknowledge(create!, { path: '/notes.md', kind: 'document', itemId: 'notes' });
    await fs.revert(remove!);

    expect(await fs.collectChanges()).toEqual([]);
    expect(await fs.readFile('/docs/guide.md')).toBe('Guide');
  });

  it('routes the open document through its virtual file', async () => {
    let fs = createFs();
    let written: string[] = [];
    fs.setVirtualFile('/docs/guide.md', {
      read: async () => 'Live guide',
      write: async content => {
        written.push(content);
      }
    });

    expect(await fs.readFile('/docs/guide.md')).toBe('Live guide');
    await fs.writeFile('/docs/guide.md', 'Edited');
    expect(written).toEqual(['Edited']);
    await expect(fs.rm('/docs/guide.md')).rejects.toThrow(/EPERM/);
    expect(await fs.collectChanges()).toEqual([]);
  });
});
