import type { StoreItemKind } from '@metorial/db';

export type StoreVersionItemIdentity = {
  kind: StoreItemKind;
  path: string;
  fileOid: bigint | null;
  documentOid: bigint | null;
  documentTitle: string | null;
  documentVersionOid: bigint | null;
};

type SnapshotDocument = {
  contentOid: bigint;
  content: { content: string };
  currentVersion: {
    oid: bigint;
    contentOid: bigint;
    previousVersion: { oid: bigint; contentOid: bigint; content: { content: string } } | null;
  } | null;
};

// The draft-version flush supersedes a version by retiring its content into an immutable copy and
// opening a successor on the live content. Until someone edits it, that successor holds the same
// content as its predecessor, so the predecessor is the immutable version to pin.
export let getUneditedPreviousDocumentVersion = (document: SnapshotDocument) => {
  let currentVersion = document.currentVersion;
  let previousVersion = currentVersion?.previousVersion;
  if (!currentVersion || !previousVersion) return null;

  if (currentVersion.contentOid !== document.contentOid) return null;
  if (previousVersion.contentOid === document.contentOid) return null;
  if (previousVersion.content.content !== document.content.content) return null;

  return previousVersion;
};

export let resolveSnapshotDocumentVersionOid = (document: SnapshotDocument) =>
  getUneditedPreviousDocumentVersion(document)?.oid ?? document.currentVersion?.oid ?? null;

export let isSameStoreVersionItemSet = (
  left: StoreVersionItemIdentity[],
  right: StoreVersionItemIdentity[]
) => {
  if (left.length !== right.length) return false;

  let rightByPath = new Map(right.map(item => [item.path, item]));

  return left.every(item => {
    let other = rightByPath.get(item.path);

    return (
      !!other &&
      other.kind === item.kind &&
      other.fileOid === item.fileOid &&
      other.documentOid === item.documentOid &&
      other.documentTitle === item.documentTitle &&
      other.documentVersionOid === item.documentVersionOid
    );
  });
};
