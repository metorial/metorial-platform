import { withTransaction } from '@metorial/db';

export let convertSkillDestinationRowsToBucketPaths = async (destinationOid: bigint) =>
  await withTransaction(async db => {
    await db.$executeRaw`
      DELETE FROM "SkillDestinationFile" AS slashed
      WHERE slashed."destinationOid" = ${destinationOid}
        AND slashed."path" LIKE '/%'
        AND EXISTS (
          SELECT 1 FROM "SkillDestinationFile" AS bare
          WHERE bare."destinationOid" = ${destinationOid}
            AND '/' || bare."path" = slashed."path"
        )
    `;
    await db.$executeRaw`
      UPDATE "SkillDestinationFile"
      SET "path" = '/' || "path",
          "pathBytes" = convert_to('/' || "path", 'UTF8'),
          "updatedAt" = now()
      WHERE "destinationOid" = ${destinationOid} AND "path" NOT LIKE '/%'
    `;
    await db.skillDestinationFile.updateMany({
      where: { destinationOid },
      data: {
        signature: '',
        gitBlobSha: null,
        sha256: null,
        byteSize: null,
        crc32: null,
        sourceKind: null,
        sourceKey: null,
        sourceFileOid: null
      }
    });
  });

export let convertSkillDestinationRowsToManifestPaths = async (destinationOid: bigint) =>
  await withTransaction(async db => {
    await db.$executeRaw`
      DELETE FROM "SkillDestinationFile" AS slashed
      WHERE slashed."destinationOid" = ${destinationOid}
        AND slashed."path" LIKE '/%'
        AND (
          ltrim(slashed."path", '/') = ''
          OR EXISTS (
            SELECT 1 FROM "SkillDestinationFile" AS bare
            WHERE bare."destinationOid" = ${destinationOid}
              AND bare."path" = ltrim(slashed."path", '/')
          )
        )
    `;
    await db.$executeRaw`
      UPDATE "SkillDestinationFile"
      SET "path" = ltrim("path", '/'),
          "pathBytes" = convert_to(ltrim("path", '/'), 'UTF8'),
          "updatedAt" = now()
      WHERE "destinationOid" = ${destinationOid} AND "path" LIKE '/%'
    `;
  });
