import type { Prisma, StoreItemKind } from '@metorial-cargo/db';

export let skillVersionSnapshotInclude = {
  storeVersion: {
    include: {
      items: {
        include: {
          file: true,
          document: true,
          documentVersion: {
            include: {
              content: true
            }
          }
        },
        orderBy: [
          {
            path: 'asc'
          },
          {
            id: 'asc'
          }
        ]
      }
    }
  }
} satisfies Prisma.SkillVersionInclude;

export type SnapshotRecord = Prisma.SkillVersionGetPayload<{
  include: typeof skillVersionSnapshotInclude;
}>;

export type SnapshotItemRecord = SnapshotRecord['storeVersion']['items'][number];

export type SnapshotItem = {
  kind: StoreItemKind;
  path: string;
  fileOid?: bigint | null;
  fileId?: string;
  documentOid?: bigint | null;
  documentId?: string;
  documentTitle?: string;
  documentVersionOid?: bigint | null;
  documentVersionId?: string;
  content?: string;
};

export type Snapshot = {
  skillVersion: SnapshotRecord;
  itemsByPath: Map<string, SnapshotItem>;
};

export let toSnapshotItem = (item: SnapshotItemRecord): SnapshotItem => ({
  kind: item.kind,
  path: item.path,
  fileOid: item.fileOid,
  fileId: item.file?.id,
  documentOid: item.documentOid,
  documentId: item.document?.id,
  documentTitle: item.documentTitle ?? item.document?.title,
  documentVersionOid: item.documentVersionOid,
  documentVersionId: item.documentVersion?.id,
  content: item.documentVersion?.content.content
});

export let normalizeSnapshot = (skillVersion: SnapshotRecord): Snapshot => ({
  skillVersion,
  itemsByPath: new Map(
    skillVersion.storeVersion.items.map(item => [item.path, toSnapshotItem(item)])
  )
});

let itemToken = (item: SnapshotItem | undefined) => {
  if (!item) return 'missing';
  if (item.kind === 'document') {
    return JSON.stringify({
      kind: item.kind,
      content: item.content ?? '',
      title: item.documentTitle ?? null
    });
  }

  return JSON.stringify({
    kind: item.kind,
    fileOid: item.fileOid?.toString() ?? null,
    documentOid: item.documentOid?.toString() ?? null
  });
};

export let sameSnapshotItem = (
  left: SnapshotItem | undefined,
  right: SnapshotItem | undefined
) => itemToken(left) === itemToken(right);

export let sameSnapshot = (left: Snapshot, right: Snapshot) => {
  let paths = new Set([...left.itemsByPath.keys(), ...right.itemsByPath.keys()]);

  for (let path of paths) {
    if (!sameSnapshotItem(left.itemsByPath.get(path), right.itemsByPath.get(path))) {
      return false;
    }
  }

  return true;
};
