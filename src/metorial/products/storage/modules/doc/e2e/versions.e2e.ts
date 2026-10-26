import { eventually, firstPage, useMember, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  cleanupDocumentVersion,
  documentVersionService,
  flushExpiredDraftVersion,
  listStaleDocumentVersions,
  sealDocumentVersion
} from '../src';
import {
  actorAuthorization,
  byteSize,
  captureFabric,
  cloneDocument,
  createDocument,
  editAndFlush,
  editDocument,
  ensureOrganizationResourceActor,
  expireVersionWindow,
  getDocument,
  listVersions,
  privileged,
  scopeOf
} from './_fixtures';

let days = (count: number) => count * 24 * 60 * 60 * 1000;

let createTwoVersions = async (fixture: OrganizationFixture) => {
  let document = await createDocument(fixture, { content: 'version one' });
  await expireVersionWindow(document);
  let current = await editAndFlush(fixture, document, { content: 'version two' });
  let [first, second] = await listVersions(document);

  return { document: current, first: first!, second: second! };
};

describe('module-documents versions', () => {
  let org = useOrganization();
  let member = useMember(org);

  it('keeps writing into the current version while its window is open', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture, { content: 'initial' });

    await editAndFlush(fixture, document, { content: 'second write' });
    let current = await editAndFlush(fixture, document, { content: 'third write' });

    let versions = await listVersions(document);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.content.content).toBe('third write');
    expect(versions[0]!.contentOid).toBe(current.contentOid);
    expect(current.maxVersionNumber).toBe(1);
    expect(current.currentVersion?.id).toBe(versions[0]!.id);
  });

  it('does not cut a version for a title-only change', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture, { content: 'body' });
    await expireVersionWindow(document);

    let current = await editAndFlush(fixture, document, { title: 'Renamed only' });
    expect(current.title).toBe('Renamed only');
    expect(await listVersions(document)).toHaveLength(1);
  });

  it('freezes the previous version once a write lands after the window', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { document, first, second } = await createTwoVersions(fixture);

    expect(document.maxVersionNumber).toBe(2);
    expect(document.currentVersion?.id).toBe(second.id);
    expect(document.content.content).toBe('version two');
    expect(first).toMatchObject({ versionNumber: 1, previousVersionOid: null });
    expect(first.content.content).toBe('version one');
    expect(first.contentOid).not.toBe(document.contentOid);
    expect(second).toMatchObject({ versionNumber: 2, previousVersionOid: first.oid });
    expect(second.contentOid).toBe(document.contentOid);

    await editAndFlush(fixture, document, { content: 'version two, revised' });

    let [firstAgain, secondAgain, third] = await listVersions(document);
    expect(third).toBeUndefined();
    expect(firstAgain!.content.content).toBe('version one');
    expect(firstAgain!.contentOid).toBe(first.contentOid);
    expect(secondAgain!.content.content).toBe('version two, revised');

    let old = await documentVersionService.getDocumentVersionById({
      ...scopeOf(fixture),
      documentVersionId: first.id,
      authorization: privileged
    });
    expect(old.content.content).toBe('version one');
    expect(old.document.id).toBe(document.id);

    let latest = await documentVersionService.getDocumentVersionById({
      ...scopeOf(fixture),
      documentVersionId: second.id,
      authorization: privileged
    });
    expect(latest.previousVersion?.id).toBe(first.id);
  });

  it('lists versions newest first, pages through them and filters them', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let creator = await ensureOrganizationResourceActor(fixture);
    let memberFixture = await loadOrganizationFixture({
      ...org.ids,
      userId: member.user.id
    });
    let editor = await ensureOrganizationResourceActor(memberFixture);

    let document = await createDocument(fixture, {
      content: 'by creator',
      authorization: actorAuthorization(creator)
    });
    await expireVersionWindow(document);
    await editAndFlush(fixture, document, {
      content: 'by member',
      authorization: actorAuthorization(editor)
    });
    await expireVersionWindow(document);
    await editAndFlush(fixture, document, {
      content: 'by member again',
      authorization: actorAuthorization(editor)
    });
    let [v1, v2, v3] = await listVersions(document);

    let list = async (
      filters: Partial<Parameters<typeof documentVersionService.listDocumentVersions>[0]> = {}
    ) =>
      (
        await firstPage(
          await documentVersionService.listDocumentVersions({
            ...scopeOf(fixture),
            documentId: document.id,
            authorization: privileged,
            ...filters
          })
        )
      ).map(version => version.id);

    expect(await list()).toEqual([v3!.id, v2!.id, v1!.id]);
    expect(await list({ ids: [v1!.id, v3!.id] })).toEqual([v3!.id, v1!.id]);
    expect(await list({ editorActorIds: [creator.id] })).toEqual([v1!.id]);
    expect(await list({ editorActorIds: [editor.id] })).toEqual([v3!.id, v2!.id]);
    expect(await list({ createdAt: { gt: new Date(Date.now() + days(1)) } })).toEqual([]);

    let paginator = await documentVersionService.listDocumentVersions({
      ...scopeOf(fixture),
      documentId: document.id,
      authorization: privileged
    });
    let seen: string[] = [];
    let after: string | undefined;
    for (let page = 0; page < 5; page++) {
      let result = await paginator.run({ limit: 1, after });
      seen.push(...result.items.map(item => item.id));
      if (!result.pagination.hasNextPage) break;
      after = result.items.at(-1)!.id;
    }
    expect(seen).toEqual([v3!.id, v2!.id, v1!.id]);

    let participant = await db.documentParticipant.findUniqueOrThrow({
      where: {
        documentOid_resourceActorOid: {
          documentOid: document.oid,
          resourceActorOid: editor.oid
        }
      }
    });
    expect(participant).toMatchObject({ role: 'editor', editCount: 2 });
  });

  it('seals a frozen version with one audit scope per editor', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let creator = await ensureOrganizationResourceActor(fixture);
    let document = await createDocument(fixture, {
      content: 'sealed body',
      authorization: actorAuthorization(creator)
    });
    await expireVersionWindow(document);
    await editAndFlush(fixture, document, { content: 'next body' });
    let [first, second] = await listVersions(document);

    let sealed = captureFabric('document.version.sealed:after');
    let result = await sealDocumentVersion({ documentVersionId: first!.id }).finally(
      sealed.stop
    );

    expect(result).toEqual({ editorCount: 1 });
    let event = sealed.events.find(item => item.version.id === first!.id);
    expect(event).toMatchObject({
      document: { id: document.id },
      version: { versionNumber: 1, byteSize: byteSize('sealed body') },
      previousVersionId: null
    });
    expect(event!.editors).toHaveLength(1);
    expect(event!.editors[0]!.auditScope).toMatchObject({
      actor: { type: 'org_actor', id: fixture.actor.id },
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid,
      organizationActorOid: fixture.actor.oid,
      context: { ip: fixture.context.ip, ua: fixture.context.ua }
    });

    expect(await sealDocumentVersion({ documentVersionId: second!.id })).toBeNull();
    expect(await sealDocumentVersion({ documentVersionId: 'docv_missing' })).toBeNull();
  });

  it('cuts a version for an expired window without a content change', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture, { content: 'steady' });
    let expiredAt = await expireVersionWindow(document);

    expect(
      await flushExpiredDraftVersion({
        documentId: document.id,
        expectedDraftVersionExpiresAt: new Date(expiredAt.getTime() - 1)
      })
    ).toBeNull();
    expect(await listVersions(document)).toHaveLength(1);

    let result = await flushExpiredDraftVersion({
      documentId: document.id,
      expectedDraftVersionExpiresAt: expiredAt
    });
    expect(result?.createdVersionId).toBeTruthy();

    let row = await db.document.findUniqueOrThrow({ where: { id: document.id } });
    expect(row.draftVersionExpiresAt).toBeNull();
    expect(row.maxVersionNumber).toBe(2);

    let [first, second] = await listVersions(document);
    expect(second!.id).toBe(result!.createdVersionId);
    expect(second!.contentOid).toBe(row.contentOid);
    expect(first!.contentOid).not.toBe(row.contentOid);
    expect(first!.content.content).toBe('steady');
    expect(second!.content.content).toBe('steady');
  });

  it('does not cut a version from the window cron while a draft is pending', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture, { content: 'steady' });
    let expiredAt = await expireVersionWindow(document);
    await editDocument(fixture, document, { content: 'pending' });

    expect(
      await flushExpiredDraftVersion({
        documentId: document.id,
        expectedDraftVersionExpiresAt: expiredAt
      })
    ).toBeNull();
    expect(await listVersions(document)).toHaveLength(1);
  });

  it('cleans up superseded versions but never the current one', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { document, first, second } = await createTwoVersions(fixture);

    expect(await cleanupDocumentVersion({ documentVersionId: second.id })).toBe(false);

    await db.documentVersion.update({
      where: { id: first.id },
      data: { createdAt: new Date(Date.now() - days(31)) }
    });
    await db.documentVersion.update({
      where: { id: second.id },
      data: { createdAt: new Date(Date.now() - days(31)) }
    });
    let stale = (await listStaleDocumentVersions({ limit: 100_000 })).map(item => item.id);
    expect(stale).toContain(first.id);
    expect(stale).not.toContain(second.id);

    expect(await cleanupDocumentVersion({ documentVersionId: first.id })).toBe(true);
    expect(await db.documentVersion.findUnique({ where: { id: first.id } })).toBeNull();
    expect(
      await db.documentContent.findUnique({ where: { oid: first.contentOid } })
    ).toBeNull();

    let remaining = await listVersions(document);
    expect(remaining.map(version => version.id)).toEqual([second.id]);
    expect(remaining[0]!.previousVersionOid).toBeNull();
    expect((await getDocument(fixture, document.id)).content.content).toBe('version two');

    expect(await cleanupDocumentVersion({ documentVersionId: first.id })).toBe(false);
  });

  it('moves a synced clone to each new parent version through the sync queue', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let parent = await createDocument(fixture, { content: '# Parent\n\nv1' });
    let child = await cloneDocument(fixture, await getDocument(fixture, parent.id));

    await expireVersionWindow(parent);
    let updatedParent = await editAndFlush(fixture, parent, { content: '# Parent\n\nv2' });
    expect(updatedParent.maxVersionNumber).toBe(2);

    let synced = await eventually(async () => {
      let row = await db.document.findUniqueOrThrow({
        where: { id: child.id },
        include: { content: true, currentVersion: true }
      });
      expect(row.maxVersionNumber).toBe(2);
      return row;
    });
    expect(synced.isContentOwner).toBe(false);
    expect(synced.content.content).toBe('# Parent\n\nv2');
    expect(synced.contentOid).toBe(updatedParent.contentOid);
    expect(synced.currentVersion?.contentOid).toBe(updatedParent.currentVersion!.contentOid);

    let [childFirst] = await listVersions(child);
    expect(childFirst!.content.content).toBe('# Parent\n\nv1');
  });
});
