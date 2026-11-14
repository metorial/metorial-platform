import { describe, expect, it } from 'vitest';
import { canDeleteDisplacedFile } from './fileReplacement';

let unreferencedFile = {
  isSameFile: false,
  status: 'active',
  isInternal: false,
  isReadOnly: false,
  isTemplateBacking: false,
  hasDocument: false,
  fileLinkCount: 0,
  hasFileReferences: false,
  referenceCounts: {
    storeItems: 0,
    storeVersionItems: 0,
    skillExports: 0,
    skillImports: 0,
    mergeRequests: 0
  }
};

describe('displaced file cleanup', () => {
  it('deletes an active writable file without durable uses', () => {
    expect(canDeleteDisplacedFile(unreferencedFile)).toBe(true);
  });

  it('does not treat a file link itself as a durable reference', () => {
    expect(canDeleteDisplacedFile({ ...unreferencedFile, fileLinkCount: 3 })).toBe(true);
  });

  it('keeps a file with an actual file reference', () => {
    expect(canDeleteDisplacedFile({ ...unreferencedFile, hasFileReferences: true })).toBe(
      false
    );
  });

  it('keeps a file for every kind of remaining durable use', () => {
    for (let reference of Object.keys(unreferencedFile.referenceCounts)) {
      expect(
        canDeleteDisplacedFile({
          ...unreferencedFile,
          referenceCounts: {
            ...unreferencedFile.referenceCounts,
            [reference]: 1
          }
        })
      ).toBe(false);
    }
    expect(canDeleteDisplacedFile({ ...unreferencedFile, hasDocument: true })).toBe(false);
  });

  it('keeps the replacement itself and protected files', () => {
    expect(canDeleteDisplacedFile({ ...unreferencedFile, isSameFile: true })).toBe(false);
    expect(canDeleteDisplacedFile({ ...unreferencedFile, isInternal: true })).toBe(false);
    expect(canDeleteDisplacedFile({ ...unreferencedFile, isReadOnly: true })).toBe(false);
    expect(canDeleteDisplacedFile({ ...unreferencedFile, isTemplateBacking: true })).toBe(
      false
    );
  });
});
