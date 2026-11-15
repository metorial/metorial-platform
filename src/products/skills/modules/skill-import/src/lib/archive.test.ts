import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { extractSkillArchive } from './archive';

let extractedLimit = 30 * 1024 * 1024;

let zipOf = async (files: Record<string, string | Uint8Array>) => {
  let zip = new JSZip();
  for (let [path, content] of Object.entries(files)) zip.file(path, content);
  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
};

let understateEntrySize = (archive: Uint8Array, declaredSize: number) => {
  let patched = new Uint8Array(archive);
  let view = new DataView(patched.buffer);
  let centralDirectory = view.getUint32(patched.byteLength - 22 + 16, true);

  view.setUint32(22, declaredSize, true);
  view.setUint32(centralDirectory + 24, declaredSize, true);

  return patched;
};

let decode = (files: { path: string; content: Uint8Array }[]) =>
  Object.fromEntries(files.map(file => [file.path, new TextDecoder().decode(file.content)]));

describe('extractSkillArchive', () => {
  it('extracts every file and strips a single wrapper directory', async () => {
    let files = await extractSkillArchive(
      await zipOf({ 'repo/SKILL.md': '# Skill', 'repo/docs/a.md': 'a' })
    );

    expect(decode(files)).toEqual({ '/SKILL.md': '# Skill', '/docs/a.md': 'a' });
  });

  it('rejects an entry whose header understates its expanded size', async () => {
    let archive = understateEntrySize(
      await zipOf({ 'SKILL.md': new Uint8Array(extractedLimit + 1) }),
      1
    );

    await expect(extractSkillArchive(archive)).rejects.toThrow(
      'Skill archive expands beyond the import size limit'
    );
  });

  it('rejects entries that only exceed the limit together', async () => {
    let half = new Uint8Array(extractedLimit / 2 + 1);

    await expect(
      extractSkillArchive(await zipOf({ 'a.md': half, 'b.md': half }))
    ).rejects.toThrow('Skill archive expands beyond the import size limit');
  });

  it('rejects an archive whose headers declare more than the limit before inflating', async () => {
    let archive = understateEntrySize(
      await zipOf({ 'SKILL.md': '# Skill' }),
      extractedLimit + 1
    );

    await expect(extractSkillArchive(archive)).rejects.toThrow(
      'Skill archive expands beyond the import size limit'
    );
  });

  it('rejects a parent-directory path', async () => {
    await expect(
      extractSkillArchive(await zipOf({ 'SKILL.md': '# Skill', '../evil.md': 'x' }))
    ).rejects.toThrow('Skill archive contains an unsafe path');
  });

  it('rejects a path with control characters', async () => {
    await expect(
      extractSkillArchive(await zipOf({ 'SKILL.md': '# Skill', 'docs/a\u0000.md': 'x' }))
    ).rejects.toThrow('Skill archive contains an unsafe path');
  });

  it('rejects entries that normalize to the same path', async () => {
    await expect(
      extractSkillArchive(
        await zipOf({ 'docs/a.md': 'a', 'docs\\a.md': 'b', 'SKILL.md': '#' })
      )
    ).rejects.toThrow('Skill archive contains duplicate paths');
  });
});
