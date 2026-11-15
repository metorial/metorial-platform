import {
  expectServiceError,
  firstPage,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { resourceActorService } from '@metorial/module-resource-actor';
import { describe, expect, it } from 'vitest';
import {
  skillMergeRequestCommentService,
  skillMergeRequestEventService,
  skillMergeRequestService,
  type SkillMergeRequestRecord
} from '../src';
import {
  addDocument,
  createForkPair,
  ensureResourceActor,
  eventTypes,
  getItemByPath,
  getMergeRequest,
  openMergeRequest,
  privileged,
  scopeOf,
  uniquePath
} from './_fixtures';

let openReviewedMergeRequest = async (fixture: OrganizationFixture) => {
  let { fork } = await createForkPair(fixture);
  let firstPath = uniquePath('first');
  let secondPath = uniquePath('second');
  await addDocument(fixture, fork, firstPath, 'first change');
  await addDocument(fixture, fork, secondPath, 'second change');

  let mergeRequest = await openMergeRequest(fixture, fork);

  return {
    fork,
    mergeRequest,
    firstPath,
    secondPath,
    firstItem: await getItemByPath(mergeRequest, firstPath),
    secondItem: await getItemByPath(mergeRequest, secondPath)
  };
};

let listComments = async (
  fixture: OrganizationFixture,
  mergeRequest: SkillMergeRequestRecord,
  itemId?: string
) =>
  (
    await firstPage(
      await skillMergeRequestCommentService.listComments({
        ...scopeOf(fixture),
        mergeRequest,
        itemId
      })
    )
  ).map(comment => comment.id);

describe('module-skill-merge-requests comments', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let comment = (
    fixture: OrganizationFixture,
    mergeRequest: SkillMergeRequestRecord,
    actor: Parameters<typeof skillMergeRequestCommentService.createComment>[0]['actor'],
    input: {
      body?: string;
      itemId?: string;
      path?: string | null;
      inReplyToCommentId?: string;
    } = {}
  ) =>
    skillMergeRequestCommentService.createComment({
      ...scopeOf(fixture),
      mergeRequest,
      actor,
      body: input.body ?? uniqueId('comment'),
      itemId: input.itemId,
      path: input.path,
      inReplyToCommentId: input.inReplyToCommentId
    });

  it('threads comments on the merge request, its items and their paths', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let actor = await ensureResourceActor(fixture);
    let { mergeRequest, firstPath, secondPath, firstItem, secondItem } =
      await openReviewedMergeRequest(fixture);

    let general = await comment(fixture, mergeRequest, actor, { body: 'Looks good overall' });
    expect(general).toMatchObject({
      body: 'Looks good overall',
      path: null,
      skillMergeRequestItemOid: null,
      inReplyToCommentOid: null,
      resourceActorOid: actor.oid,
      deletedAt: null
    });

    let onItem = await comment(fixture, mergeRequest, actor, { itemId: firstItem.id });
    expect(onItem.path).toBe(firstPath);
    expect(onItem.skillMergeRequestItemOid).toBe(firstItem.oid);

    let onPath = await comment(fixture, mergeRequest, actor, { path: secondPath });
    expect(onPath.path).toBe(secondPath);
    expect(onPath.skillMergeRequestItemOid).toBe(secondItem.oid);

    let reply = await comment(fixture, mergeRequest, actor, {
      inReplyToCommentId: onItem.id
    });
    expect(reply).toMatchObject({
      path: firstPath,
      skillMergeRequestItemOid: firstItem.oid,
      inReplyToCommentOid: onItem.oid
    });

    expect(await listComments(fixture, mergeRequest)).toEqual([
      general.id,
      onItem.id,
      onPath.id,
      reply.id
    ]);
    expect(await listComments(fixture, mergeRequest, firstItem.id)).toEqual([
      onItem.id,
      reply.id
    ]);
    expect(await listComments(fixture, mergeRequest, secondItem.id)).toEqual([onPath.id]);

    let events = await firstPage(
      await skillMergeRequestEventService.listEvents({
        ...scopeOf(fixture),
        authorization: privileged,
        mergeRequest,
        types: ['commented']
      })
    );
    expect(events.map(event => event.comment?.id)).toEqual([
      general.id,
      onItem.id,
      onPath.id,
      reply.id
    ]);
    expect(events.every(event => event.resourceActor?.id === actor.id)).toBe(true);

    let refreshed = await getMergeRequest(fixture, mergeRequest.id);
    expect(refreshed._count.comments).toBe(4);
  });

  it('rejects comments with an empty body or a mismatched item, path or reply', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let actor = await ensureResourceActor(fixture);
    let otherActor = await ensureResourceActor(other);
    let { mergeRequest, secondPath, firstItem, secondItem } =
      await openReviewedMergeRequest(fixture);
    let parent = await comment(fixture, mergeRequest, actor, { itemId: firstItem.id });

    let cases: [() => Promise<unknown>, string, RegExp?][] = [
      [
        () => comment(fixture, mergeRequest, actor, { body: '   ' }),
        'bad_request',
        /cannot be empty/
      ],
      [
        () => comment(fixture, mergeRequest, actor, { path: '/not-in-the-request.md' }),
        'bad_request',
        /must match a merge request item/
      ],
      [
        () =>
          comment(fixture, mergeRequest, actor, { itemId: firstItem.id, path: secondPath }),
        'bad_request',
        /must match the selected merge request item/
      ],
      [
        () =>
          comment(fixture, mergeRequest, actor, {
            itemId: secondItem.id,
            inReplyToCommentId: parent.id
          }),
        'bad_request',
        /same merge request item/
      ],
      [
        () =>
          comment(fixture, mergeRequest, actor, {
            path: secondPath,
            inReplyToCommentId: parent.id
          }),
        'bad_request',
        /same path/
      ],
      [() => comment(fixture, mergeRequest, actor, { itemId: 'skmri_missing' }), 'not_found'],
      [
        () => comment(fixture, mergeRequest, actor, { inReplyToCommentId: 'skmrc_missing' }),
        'not_found'
      ],
      [() => comment(fixture, mergeRequest, otherActor), 'bad_request', /does not belong/]
    ];

    for (let [call, code, message] of cases) {
      let error = await expectServiceError(call(), code);
      if (message) expect(error.message).toMatch(message);
    }

    expect(
      await db.skillMergeRequestComment.count({
        where: { skillMergeRequestOid: mergeRequest.oid }
      })
    ).toBe(1);
    expect(await eventTypes(mergeRequest)).toEqual(['created', 'commented']);
  });

  it('lets only the author or an organization manager edit and delete a comment', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let memberFixture = await loadOrganizationFixture({
      organizationId: org.ids.organizationId,
      userId: member.user.id
    });
    let author = await ensureResourceActor(fixture);
    let manager = await ensureResourceActor(memberFixture);
    let external = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier: uniqueId('external-reviewer'), name: 'External reviewer' }
    });
    expect(manager.id).not.toBe(author.id);
    expect(external.organizationActorOid).toBeNull();

    let { mergeRequest } = await openReviewedMergeRequest(fixture);
    let created = await comment(fixture, mergeRequest, author, { body: 'Original' });

    let update = (
      actor: typeof author,
      body: string,
      canManageComments?: boolean,
      target = created
    ) =>
      skillMergeRequestCommentService.updateComment({
        ...scopeOf(fixture),
        mergeRequest,
        comment: target,
        actor,
        body,
        canManageComments
      });

    let remove = (actor: typeof author, canManageComments?: boolean) =>
      skillMergeRequestCommentService.deleteComment({
        ...scopeOf(fixture),
        mergeRequest,
        comment: created,
        actor,
        canManageComments
      });

    await expectServiceError(update(manager, 'By the member'), 'forbidden');
    await expectServiceError(update(external, 'By an outsider', true), 'forbidden');
    await expectServiceError(update(author, '  '), 'bad_request');

    let managed = await update(manager, 'Edited by a manager', true);
    expect(managed.body).toBe('Edited by a manager');
    expect(managed.resourceActorOid).toBe(author.oid);

    let edited = await update(author, 'Edited by the author');
    expect(edited.body).toBe('Edited by the author');

    await expectServiceError(remove(manager), 'forbidden');
    await expectServiceError(remove(external, true), 'forbidden');
    expect(
      (await db.skillMergeRequestComment.findUniqueOrThrow({ where: { id: created.id } }))
        .deletedAt
    ).toBeNull();

    let deleted = await remove(author);
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(await listComments(fixture, mergeRequest)).toEqual([]);
    await expectServiceError(
      skillMergeRequestCommentService.getSkillMergeRequestCommentById({
        mergeRequest,
        commentId: created.id
      }),
      'not_found'
    );

    let withDeleted = await skillMergeRequestCommentService.getSkillMergeRequestCommentById({
      mergeRequest,
      commentId: created.id,
      includeDeleted: true
    });
    expect(withDeleted.body).toBe('Edited by the author');

    let commented = await db.skillMergeRequestEvent.findFirstOrThrow({
      where: { skillMergeRequestOid: mergeRequest.oid, type: 'commented' }
    });
    expect(commented.commentOid).toBe(created.oid);
  });

  it('accepts comments on closed merge requests', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let actor = await ensureResourceActor(fixture);
    let { mergeRequest } = await openReviewedMergeRequest(fixture);

    let closed = await skillMergeRequestService.closeSkillMergeRequest({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      mergeRequest
    });
    let afterClose = await comment(fixture, closed, actor, { body: 'Closing remark' });

    expect(await listComments(fixture, closed)).toEqual([afterClose.id]);
    expect(await eventTypes(closed)).toEqual(['created', 'closed', 'commented']);
  });

  it('keeps comments, items and events scoped to their merge request', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let actor = await ensureResourceActor(fixture);
    let first = await openReviewedMergeRequest(fixture);
    let second = await openReviewedMergeRequest(fixture);
    let parent = await comment(fixture, first.mergeRequest, actor);

    await expectServiceError(
      skillMergeRequestCommentService.getSkillMergeRequestCommentById({
        mergeRequest: second.mergeRequest,
        commentId: parent.id
      }),
      'not_found'
    );
    await expectServiceError(
      comment(fixture, second.mergeRequest, actor, { inReplyToCommentId: parent.id }),
      'not_found'
    );
    await expectServiceError(
      comment(fixture, second.mergeRequest, actor, { itemId: first.firstItem.id }),
      'not_found'
    );
    await expectServiceError(
      skillMergeRequestCommentService.listComments({
        ...scopeOf(fixture),
        mergeRequest: second.mergeRequest,
        itemId: first.firstItem.id
      }),
      'not_found'
    );

    let firstCreated = await db.skillMergeRequestEvent.findFirstOrThrow({
      where: { skillMergeRequestOid: first.mergeRequest.oid, type: 'created' }
    });
    await expectServiceError(
      skillMergeRequestEventService.getEventById({
        ...scopeOf(fixture),
        authorization: privileged,
        mergeRequest: second.mergeRequest,
        eventId: firstCreated.id
      }),
      'not_found'
    );

    expect(await listComments(fixture, second.mergeRequest)).toEqual([]);
  });
});
