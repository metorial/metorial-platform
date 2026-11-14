import { uniqueId } from '@metorial/e2e';
import { getCargoFilesBucketName, getStorage } from '@metorial/module-file';
import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { uploadManifestFile } from '../src/lib/manifestFile/storage';
import { writeManifestFile } from '../src/lib/manifestFile/writer';
import {
  createSkillExportZipJob,
  disposeSkillExportZipSpec,
  getSkillExportArchiveKey,
  prepareSkillExportZipSpec
} from '../src/lib/skillExportArchive';
import { readZipArchive } from './_zip';

describe('spooled zip export specs', () => {
  it('builds an archive of more than 10,000 entries from a spec sent from disk', async () => {
    let bucket = getCargoFilesBucketName();
    let content = Buffer.from(`# ${uniqueId('skill')}\n`);
    let sha256 = createHash('sha256').update(content).digest('hex');
    let key = `skill-sync/blobs/sha256/${sha256}`;
    await getStorage().putObject(bucket, key, content);

    let entries = Array.from({ length: 10_001 }, (_, i) => ({
      path: `plugins/p${String(i).padStart(5, '0')}/SKILL.md`,
      gitBlobSha: createHash('sha1').update(content).digest('hex'),
      sha256,
      size: content.byteLength,
      crc32: crc32(content),
      key
    }));
    let destinationId = uniqueId('sdst');
    let written = await writeManifestFile({
      destinationId,
      sourceBucket: bucket,
      scope: { dirs: ['plugins'], files: [], globs: [] },
      entries
    });
    let ref = await uploadManifestFile({ destinationId, manifest: written });

    let skillExportId = uniqueId('ske');
    let prepared = await prepareSkillExportZipSpec({
      skillExportId,
      manifest: { objectKey: ref.key, sha256: ref.sha256, entryCount: ref.entryCount }
    });
    expect('path' in prepared).toBe(true);

    try {
      let job = await createSkillExportZipJob(`skill-export-${skillExportId}`, prepared, {
        waitSeconds: 60
      });
      expect(job).toMatchObject({ state: 'completed', progress: { entriesTotal: 10_001 } });
    } finally {
      await disposeSkillExportZipSpec(prepared);
    }

    let archiveKey = getSkillExportArchiveKey(skillExportId);
    let archive = await getStorage().getObject(bucket, archiveKey);
    let archived = readZipArchive(Buffer.from(archive.data));
    expect(archived).toHaveLength(10_001);
    expect(archived[10_000]).toMatchObject({
      path: 'plugins/p10000/SKILL.md',
      data: content
    });

    await getStorage().deleteObject(bucket, archiveKey);
    await getStorage().deleteObject(bucket, ref.key);
    await getStorage().deleteObject(bucket, key);
  }, 120_000);
});
