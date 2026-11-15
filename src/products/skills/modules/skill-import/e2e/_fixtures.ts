import { parseRedisUrl } from '@lowerdeck/redis';
import { getConfig } from '@metorial/config';
import { ID, type SkillImportItemStatus, type SkillImportStatus } from '@metorial/db';
import { eventually, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { filePurposeService, fileService } from '@metorial/module-file';
import { Queue } from 'bullmq';
import JSZip from 'jszip';
import { expect } from 'vitest';
import { skillImportService } from '../src';

export let privileged = createResourceAuthorization({ restricted: false });

export let queueTimeout = { timeoutMs: 45_000, intervalMs: 500 };

export let scopeOf = (fixture: OrganizationFixture) => ({
  project: fixture.project,
  instance: fixture.instance
});

export let skillMarkdown = (name: string) =>
  `---\nname: ${name}\ndescription: Imported by the e2e suite\n---\n# ${name}\n\nDo the thing.\n`;

export let uploadFile = async (
  fixture: OrganizationFixture,
  input: { name: string; content: Uint8Array | string; mimeType: string; purposeId?: string }
) =>
  await fileService.createUploadedFile({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    purpose: input.purposeId ?? (await filePurposeService.ensureGenericFilePurpose()).id,
    file: new Blob([input.content as BlobPart], { type: input.mimeType }),
    input: {
      name: input.name,
      title: input.name,
      mimeType: input.mimeType,
      authorization: privileged
    }
  });

export let createFileRecord = async (
  fixture: OrganizationFixture,
  input: { name: string; mimeType: string; size: number }
) =>
  await fileService.createFile({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    purpose: (await filePurposeService.ensureGenericFilePurpose()).id,
    storeId: uniqueId('e2e-skill-import'),
    input: { ...input, authorization: privileged }
  });

export let importFile = async (fixture: OrganizationFixture, fileId: string) =>
  await skillImportService.createSkillImport({
    ...scopeOf(fixture),
    authorization: privileged,
    input: { type: 'file', fileId }
  });

export let zipOf = async (files: Record<string, string | Uint8Array>) => {
  let zip = new JSZip();
  for (let [path, content] of Object.entries(files)) zip.file(path, content);

  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
};

// Rewrites the uncompressed size of the archive's only entry in both the local and the
// central directory header, the way a crafted zip bomb hides its real size.
export let understateEntrySize = (archive: Uint8Array, declaredSize: number) => {
  let patched = new Uint8Array(archive);
  let view = new DataView(patched.buffer);
  let endOfCentralDirectory = patched.byteLength - 22;
  let centralDirectory = view.getUint32(endOfCentralDirectory + 16, true);

  view.setUint32(22, declaredSize, true);
  view.setUint32(centralDirectory + 24, declaredSize, true);

  return patched;
};

export let getImportRow = async (skillImportId: string) =>
  await db.skillImport.findUniqueOrThrow({
    where: { id: skillImportId },
    include: { items: { orderBy: { createdAt: 'asc' } } }
  });

export let waitForImport = async (
  skillImportId: string,
  check: (skillImport: Awaited<ReturnType<typeof getImportRow>>) => boolean
) =>
  await eventually(async () => {
    let skillImport = await getImportRow(skillImportId);
    if (!check(skillImport)) throw new Error(`Import is still ${skillImport.status}`);

    return skillImport;
  }, queueTimeout);

export let seedImport = async (
  fixture: OrganizationFixture,
  data: {
    status: SkillImportStatus;
    sourceType?: 'public_repository' | 'origin_repository' | 'uploaded_file';
    codeBucketId?: string | null;
    createdAt?: Date;
    startedAt?: Date;
  }
) =>
  await db.skillImport.create({
    data: {
      id: await ID.generateId('skillImport'),
      sourceType: data.sourceType ?? 'public_repository',
      status: data.status,
      repositoryName: uniqueId('e2e-skills'),
      codeBucketId: data.codeBucketId ?? null,
      createdAt: data.createdAt,
      startedAt: data.startedAt,
      projectOid: fixture.project.oid,
      instanceOid: fixture.instance.oid
    }
  });

export let seedItem = async (
  skillImport: { oid: bigint },
  data: { status: SkillImportItemStatus; skillOid?: bigint; targetSkillId?: string }
) =>
  await db.skillImportItem.create({
    data: {
      id: await ID.generateId('skillImportItem'),
      status: data.status,
      path: `/skills/${uniqueId('skill')}`,
      targetSkillId: data.targetSkillId ?? (await ID.generateId('skill')),
      skillOid: data.skillOid,
      skillImportOid: skillImport.oid,
      startedAt: data.status === 'pending' ? undefined : new Date(),
      completedAt:
        data.status === 'completed' || data.status === 'failed' ? new Date() : undefined
    }
  });

let importQueues: Queue[] | undefined;

let getImportQueues = () =>
  (importQueues ??= ['acquire', 'discover', 'item', 'finish'].map(
    name =>
      new Queue(`mte/cargo/skill/import/${name}`, {
        connection: parseRedisUrl(getConfig().redisUrl)
      })
  ));

// Jobs are removed on completion and finish notifications can be missed, so a job counts as
// done once none of the import queues has outstanding work left.
export let waitForIdleImportQueues = async () =>
  await eventually(async () => {
    for (let queue of getImportQueues()) {
      let counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
      expect(counts, queue.name).toEqual({
        waiting: 0,
        active: 0,
        delayed: 0,
        prioritized: 0
      });
    }
  }, queueTimeout);

export let runJob = async (job: Promise<unknown>) => {
  await job;
  await waitForIdleImportQueues();
};

export let closeImportQueues = async () => {
  await Promise.all((importQueues ?? []).map(queue => queue.close()));
  importQueues = undefined;
};
