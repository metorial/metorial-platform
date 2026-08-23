import { describe, expect, it } from 'vitest';
import {
  createSkillImportZipFromDirectory,
  createStoredZipArchive,
  getSkillImportZipPath,
  validateSkillImportDirectory
} from './skillImportZip';

let fileFromPath = (path: string, content: string) => {
  let file = new File([content], path.split('/').at(-1)!, { type: 'text/plain' });
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
};

describe('getSkillImportZipPath', () => {
  it('uses the browser relative path and skips junk files', () => {
    expect(getSkillImportZipPath(fileFromPath('reviewer/SKILL.md', '#'))).toBe(
      'reviewer/SKILL.md'
    );
    expect(getSkillImportZipPath(fileFromPath('reviewer/.DS_Store', ''))).toBeNull();
    expect(getSkillImportZipPath(fileFromPath('reviewer/.git/config', 'gitdir'))).toBeNull();
    expect(
      getSkillImportZipPath(fileFromPath('reviewer/node_modules/pkg/index.js', 'js'))
    ).toBeNull();
    expect(getSkillImportZipPath({ name: '../outside.md' })).toBeNull();
  });
});

describe('validateSkillImportDirectory', () => {
  it('requires at least one real file and enforces the zip size limit', () => {
    expect(validateSkillImportDirectory([fileFromPath('reviewer/.DS_Store', '')])).toBe(
      'Choose a folder that contains at least one file.'
    );
    expect(
      validateSkillImportDirectory([
        {
          name: 'SKILL.md',
          size: 10 * 1024 * 1024 + 1,
          webkitRelativePath: 'reviewer/SKILL.md'
        }
      ])
    ).toBe('ZIP skill archives must be 10 MB or smaller.');
    expect(
      validateSkillImportDirectory([fileFromPath('reviewer/SKILL.md', '# Skill')])
    ).toBeNull();
  });
});

describe('createSkillImportZipFromDirectory', () => {
  it('zips the selected folder and preserves file contents', async () => {
    let zipFile = await createSkillImportZipFromDirectory([
      fileFromPath('reviewer/SKILL.md', '# Reviewer'),
      fileFromPath('reviewer/scripts/check.sh', 'echo ok'),
      fileFromPath('reviewer/.DS_Store', 'junk')
    ]);

    expect(zipFile.name).toBe('reviewer.zip');
    expect(zipFile.type).toBe('application/zip');

    let bytes = new Uint8Array(await zipFile.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(bytes)).toContain('reviewer/SKILL.md');
    expect(new TextDecoder().decode(bytes)).toContain('# Reviewer');
    expect(new TextDecoder().decode(bytes)).toContain('echo ok');
    expect(new TextDecoder().decode(bytes)).not.toContain('.DS_Store');
  });

  it('creates a stored zip archive with a central directory', () => {
    let zip = createStoredZipArchive([
      { path: 'SKILL.md', data: new TextEncoder().encode('# Root') }
    ]);
    let decoded = new TextDecoder().decode(zip);

    expect(decoded).toContain('PK');
    expect(decoded).toContain('SKILL.md');
    expect(decoded).toContain('# Root');
  });
});
