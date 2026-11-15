import type { SkillDestinationFile, SkillDestinationFileSourceKind } from '@metorial/db';
import { withTransaction } from '@metorial/db';

let rowChunkSize = 500;

export type ManifestRow = {
  path: string;
  gitBlobSha: string;
  sha256: string;
  byteSize: bigint;
  crc32: bigint;
  sourceKind: SkillDestinationFileSourceKind;
  sourceKey: string;
  sourceFileOid: bigint | null;
};

export let getManifestRowSignature = (row: Pick<ManifestRow, 'gitBlobSha'>) =>
  `git:${row.gitBlobSha}`;

let chunk = <T>(items: T[], size: number) => {
  let chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

let pathEncoder = new TextEncoder();

export let getSkillDestinationFilePathBytes = (path: string) =>
  pathEncoder.encode(path.normalize('NFC'));

let toRowData = (row: ManifestRow, itemKey: string) => ({
  path: row.path,
  pathBytes: getSkillDestinationFilePathBytes(row.path),
  signature: getManifestRowSignature(row),
  itemKey,
  gitBlobSha: row.gitBlobSha,
  sha256: row.sha256,
  byteSize: row.byteSize,
  crc32: row.crc32,
  sourceKind: row.sourceKind,
  sourceKey: row.sourceKey,
  sourceFileOid: row.sourceFileOid
});

let isUnchanged = (existing: SkillDestinationFile, row: ManifestRow, itemKey: string) =>
  existing.itemKey === itemKey &&
  existing.pathBytes !== null &&
  existing.signature === getManifestRowSignature(row) &&
  existing.gitBlobSha === row.gitBlobSha &&
  existing.sha256 === row.sha256 &&
  existing.byteSize === row.byteSize &&
  existing.crc32 === row.crc32 &&
  existing.sourceKind === row.sourceKind &&
  existing.sourceKey === row.sourceKey &&
  existing.sourceFileOid === row.sourceFileOid;

// Replaces one item's rows. A path written by two live items belongs to the smaller item key, so
// overlapping output resolves the same way regardless of task order; rows left by items that
// are gone (or legacy rows without an item) are taken over.
export let replaceSkillDestinationItemRows = async (d: {
  destinationOid: bigint;
  itemKey: string;
  rows: ManifestRow[];
  liveItemKeys: Set<string>;
}) =>
  await withTransaction(async db => {
    let rows = [...new Map(d.rows.map(row => [row.path, row])).values()];

    let existing = await db.skillDestinationFile.findMany({
      where: { destinationOid: d.destinationOid, itemKey: d.itemKey }
    });
    let existingByPath = new Map(existing.map(file => [file.path, file]));

    let otherPaths = rows.map(row => row.path).filter(path => !existingByPath.has(path));
    let others = new Map<string, SkillDestinationFile>();
    for (let paths of chunk(otherPaths, rowChunkSize)) {
      let files = await db.skillDestinationFile.findMany({
        where: { destinationOid: d.destinationOid, path: { in: paths } }
      });
      for (let file of files) others.set(file.path, file);
    }

    let conflicts: { path: string; ownerItemKey: string }[] = [];
    let creates: ManifestRow[] = [];
    let updates: { oid: bigint; row: ManifestRow }[] = [];
    let unchanged = 0;

    for (let row of rows) {
      let current = existingByPath.get(row.path) ?? others.get(row.path);
      if (!current) {
        creates.push(row);
        continue;
      }

      if (
        current.itemKey &&
        current.itemKey < d.itemKey &&
        d.liveItemKeys.has(current.itemKey)
      ) {
        conflicts.push({ path: row.path, ownerItemKey: current.itemKey });
        continue;
      }

      if (isUnchanged(current, row, d.itemKey)) unchanged++;
      else updates.push({ oid: current.oid, row });
    }

    let keptPaths = new Set(rows.map(row => row.path));
    let deletes = existing.filter(file => !keptPaths.has(file.path)).map(file => file.oid);

    for (let oids of chunk(deletes, rowChunkSize)) {
      await db.skillDestinationFile.deleteMany({ where: { oid: { in: oids } } });
    }

    for (let createsChunk of chunk(creates, rowChunkSize)) {
      await db.skillDestinationFile.createMany({
        data: createsChunk.map(row => ({
          destinationOid: d.destinationOid,
          ...toRowData(row, d.itemKey)
        }))
      });
    }

    for (let update of updates) {
      await db.skillDestinationFile.update({
        where: { oid: update.oid },
        data: toRowData(update.row, d.itemKey)
      });
    }

    return {
      created: creates.length,
      updated: updates.length,
      deleted: deletes.length,
      unchanged,
      conflicts
    };
  });
