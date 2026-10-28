import { uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  importFile,
  skillMarkdown,
  understateEntrySize,
  uploadFile,
  waitForImport,
  zipOf
} from './_fixtures';

let extractedLimit = 30 * 1024 * 1024;

let manyFiles = (count: number) =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`skills/one/file-${index}.md`, `# ${index}`])
  );

let archiveCases: Array<{
  name: string;
  build: () => Promise<Uint8Array>;
  error: RegExp;
}> = [
  {
    name: 'a parent-directory path',
    build: () =>
      zipOf({ 'SKILL.md': skillMarkdown('Safe'), '../outside/SKILL.md': '# Unsafe' }),
    error: /^Skill archive contains an unsafe path: .*outside\/SKILL\.md$/
  },
  {
    name: 'a nested parent-directory path',
    build: () => zipOf({ 'repo/skills/../../../../etc/cron.d/job.md': '# Unsafe' }),
    error: /^Skill archive contains an unsafe path: /
  },
  {
    name: 'a backslash parent-directory path',
    build: () => zipOf({ 'SKILL.md': skillMarkdown('Safe'), '..\\..\\evil.md': '# Unsafe' }),
    error: /^Skill archive contains an unsafe path: .*evil\.md$/
  },
  {
    name: 'more than 5000 files',
    build: () => zipOf(manyFiles(5001)),
    error: /^Skill archive contains too many files$/
  },
  {
    name: 'an entry that expands beyond the limit',
    build: () => zipOf({ 'SKILL.md': new Uint8Array(extractedLimit + 1) }),
    error: /^Skill archive expands beyond the import size limit$/
  },
  {
    name: 'an entry whose header understates its expanded size',
    build: async () =>
      understateEntrySize(await zipOf({ 'SKILL.md': new Uint8Array(extractedLimit + 1) }), 1),
    error: /^Skill archive expands beyond the import size limit$/
  },
  {
    name: 'content that is not a ZIP archive',
    build: async () => new TextEncoder().encode(skillMarkdown('Not a zip')),
    error: /end of central directory/
  }
];

describe('module-skill-import archives', () => {
  let org = useOrganization();

  for (let archiveCase of archiveCases) {
    it(`fails an uploaded archive with ${archiveCase.name} and releases the upload`, async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let file = await uploadFile(fixture, {
        name: `${uniqueId('archive')}.zip`,
        mimeType: 'application/zip',
        content: await archiveCase.build()
      });

      let skillImport = await importFile(fixture, file.id);
      let referenceId = skillImport.sourceFileReference!.id;
      let linkId = skillImport.sourceFileLink!.id;

      let failed = await waitForImport(skillImport.id, row => row.status === 'failed');

      expect(failed.error).toMatch(archiveCase.error);
      expect(failed).toMatchObject({
        codeBucketId: null,
        sourceFileReferenceOid: null,
        sourceFileLinkOid: null,
        sourceFileOid: file.oid,
        items: []
      });
      expect(failed.startedAt).toBeInstanceOf(Date);
      expect(failed.completedAt!.getTime()).toBeGreaterThanOrEqual(
        failed.startedAt!.getTime()
      );

      expect(await db.fileReference.findUnique({ where: { id: referenceId } })).toBeNull();
      expect(await db.fileLink.findUnique({ where: { id: linkId } })).toBeNull();
      expect(await db.skill.count({ where: { instanceOid: fixture.instance.oid } })).toBe(0);
    });
  }
});
