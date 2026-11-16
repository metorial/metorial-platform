import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { getSlatePackageChecksum, readZipEntries } from '../lib/slatePackage/archive';
import { storage } from '../storage';

class artifactChecksumServiceImpl {
  async backfillPage(d: { cursor?: string; pageSize: number }) {
    let artifacts = await db.artifact.findMany({
      where: {
        oid: d.cursor ? { gt: BigInt(d.cursor) } : undefined,
        checksum: '',
        slateVersions: { some: {} }
      },
      orderBy: { oid: 'asc' },
      take: d.pageSize,
      select: { oid: true, id: true, bucket: true, storageKey: true }
    });

    let updated = 0;
    let failed = 0;

    for (let artifact of artifacts) {
      try {
        let object = await storage.getObjectStream(artifact.bucket, artifact.storageKey);
        let buffer = Buffer.from(await new Response(object.stream).arrayBuffer());
        let checksum = getSlatePackageChecksum(await readZipEntries(buffer));

        await db.artifact.updateMany({
          where: { oid: artifact.oid, checksum: '' },
          data: { checksum }
        });
        updated++;
      } catch (error) {
        failed++;
        console.warn(
          `[Registry]: Could not backfill checksum of artifact ${artifact.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return {
      updated,
      failed,
      nextCursor:
        artifacts.length === d.pageSize ? artifacts[artifacts.length - 1]!.oid.toString() : null
    };
  }
}

export let artifactChecksumService = Service.create(
  'artifactChecksumService',
  () => new artifactChecksumServiceImpl()
).build();
