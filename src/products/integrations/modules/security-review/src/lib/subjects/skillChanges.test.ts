import { describe, expect, it } from 'vitest';
import { buildChangeOverview, type SkillTreeEntry } from './skillChanges';

let entry = (
  path: string,
  identity: string,
  partial: Partial<SkillTreeEntry> = {}
): SkillTreeEntry => ({
  path,
  identity,
  kind: 'text',
  size: 10,
  loadText: null,
  ...partial
});

let tree = (...entries: SkillTreeEntry[]) => new Map(entries.map(item => [item.path, item]));

describe('buildChangeOverview', () => {
  it('summarises added, removed and modified files', async () => {
    let { summary } = await buildChangeOverview({
      previous: tree(entry('a.md', '1'), entry('gone.md', '1')),
      current: tree(entry('a.md', '2'), entry('new.md', '1'))
    });

    expect(summary.added.map(item => item.path)).toEqual(['new.md']);
    expect(summary.removed.map(item => item.path)).toEqual(['gone.md']);
    expect(summary.modified.map(item => item.path)).toEqual(['a.md']);
  });

  it('includes a diff for changed text and only says "changed" for binaries', async () => {
    let { files, summary } = await buildChangeOverview({
      previous: tree(
        entry('SKILL.md', '1', { loadText: async () => 'one\ntwo' }),
        entry('logo.png', '1', { kind: 'image', size: 100 })
      ),
      current: tree(
        entry('SKILL.md', '2', { loadText: async () => 'one\nthree' }),
        entry('logo.png', '2', { kind: 'image', size: 120 })
      )
    });

    expect(files['changes/diffs/SKILL.md.diff']).toContain('+three');
    expect(summary.modified.find(item => item.path == 'logo.png')?.diff).toBe('binary');
    expect(Object.keys(files)).not.toContain('changes/diffs/logo.png.diff');
  });

  it('calls out a file that changed type', async () => {
    let { summary } = await buildChangeOverview({
      previous: tree(entry('logo.png', '1', { kind: 'image' })),
      current: tree(entry('logo.png', '2', { kind: 'executable' }))
    });

    expect(summary.modified[0]?.kindChanged).toBe(true);
  });
});
