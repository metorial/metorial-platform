import { describe, expect, it } from 'vitest';
import {
  getUneditedPreviousDocumentVersion,
  isSameStoreVersionItemSet,
  resolveSnapshotDocumentVersionOid,
  type StoreVersionItemIdentity
} from './storeVersionSnapshot';

let liveContentOid = 10n;
let retiredContentOid = 20n;

let previousVersion = (content: string, contentOid = retiredContentOid) => ({
  oid: 1n,
  contentOid,
  content: { content }
});

let document = (d: {
  content: string;
  previousVersion?: ReturnType<typeof previousVersion> | null;
  currentContentOid?: bigint;
  hasCurrentVersion?: boolean;
}) => ({
  contentOid: liveContentOid,
  content: { content: d.content },
  currentVersion:
    d.hasCurrentVersion === false
      ? null
      : {
          oid: 2n,
          contentOid: d.currentContentOid ?? liveContentOid,
          previousVersion: d.previousVersion ?? null
        }
});

let item = (overrides: Partial<StoreVersionItemIdentity> = {}): StoreVersionItemIdentity => ({
  kind: 'document',
  path: '/doc.md',
  fileOid: 5n,
  documentOid: 6n,
  documentTitle: 'Doc',
  documentVersionOid: 7n,
  ...overrides
});

describe('getUneditedPreviousDocumentVersion', () => {
  it('returns the retired predecessor of a successor that was never edited', () => {
    let previous = previousVersion('same');

    expect(
      getUneditedPreviousDocumentVersion(
        document({ content: 'same', previousVersion: previous })
      )
    ).toBe(previous);
  });

  it('treats a successor whose content differs from its predecessor as edited', () => {
    expect(
      getUneditedPreviousDocumentVersion(
        document({ content: 'edited', previousVersion: previousVersion('original') })
      )
    ).toBeNull();
  });

  it('treats a first version without a predecessor as edited', () => {
    expect(getUneditedPreviousDocumentVersion(document({ content: 'first' }))).toBeNull();
    expect(
      getUneditedPreviousDocumentVersion(
        document({ content: 'none', hasCurrentVersion: false })
      )
    ).toBeNull();
  });

  it('ignores a predecessor that still shares the live content row', () => {
    expect(
      getUneditedPreviousDocumentVersion(
        document({ content: 'same', previousVersion: previousVersion('same', liveContentOid) })
      )
    ).toBeNull();
  });

  it('ignores a current version that is not on the live content row', () => {
    expect(
      getUneditedPreviousDocumentVersion(
        document({
          content: 'same',
          currentContentOid: 30n,
          previousVersion: previousVersion('same')
        })
      )
    ).toBeNull();
  });
});

describe('resolveSnapshotDocumentVersionOid', () => {
  it('pins the predecessor of an unedited successor', () => {
    expect(
      resolveSnapshotDocumentVersionOid(
        document({ content: 'same', previousVersion: previousVersion('same') })
      )
    ).toBe(1n);
  });

  it('pins the current version once it carries edits', () => {
    expect(
      resolveSnapshotDocumentVersionOid(
        document({ content: 'edited', previousVersion: previousVersion('original') })
      )
    ).toBe(2n);
    expect(resolveSnapshotDocumentVersionOid(document({ content: 'first' }))).toBe(2n);
  });

  it('pins nothing for a document without a version', () => {
    expect(
      resolveSnapshotDocumentVersionOid(
        document({ content: 'none', hasCurrentVersion: false })
      )
    ).toBeNull();
  });
});

describe('isSameStoreVersionItemSet', () => {
  it('matches identical item sets regardless of order', () => {
    let directory = item({
      kind: 'directory',
      path: '/',
      fileOid: null,
      documentOid: null,
      documentTitle: null,
      documentVersionOid: null
    });

    expect(isSameStoreVersionItemSet([directory, item()], [item(), directory])).toBe(true);
    expect(isSameStoreVersionItemSet([], [])).toBe(true);
  });

  it.each([
    ['kind', { kind: 'file' as const }],
    ['path', { path: '/other.md' }],
    ['file', { fileOid: 50n }],
    ['document', { documentOid: 60n }],
    ['title', { documentTitle: 'Renamed' }],
    ['pinned document version', { documentVersionOid: 70n }],
    ['missing document version', { documentVersionOid: null }]
  ])('detects a changed %s', (_field, overrides) => {
    expect(isSameStoreVersionItemSet([item(overrides)], [item()])).toBe(false);
  });

  it('detects added and removed items', () => {
    let extra = item({ path: '/extra.md' });

    expect(isSameStoreVersionItemSet([item(), extra], [item()])).toBe(false);
    expect(isSameStoreVersionItemSet([item()], [item(), extra])).toBe(false);
    expect(isSameStoreVersionItemSet([extra], [item()])).toBe(false);
  });
});
