import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import type { Prisma } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createResourceAuthorization } from '@metorial/module-access';
import { skillService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
import { skillMergeRequestEventService, skillMergeRequestService } from '../src';
import {
  addDocument,
  createForkPair,
  createSkill,
  documentItemPaths,
  ensureResourceActor,
  eventTypes,
  findStoreItem,
  getItemByPath,
  getMergeRequest,
  mergeAndWait,
  openMergeRequest,
  privileged,
  readDocument,
  scopeOf,
  uniquePath
} from './_fixtures';

let flowTimeout = 180_000;

let captureAuditEvents = () => {
  let captured: { action: string; mergeRequestId: string; status: string }[] = [];
  let unsubscribers = (['created', 'merged', 'closed', 'rolled_back'] as const).map(action =>
    Fabric.listen(`skill.merge_request.audit.${action}:after`, event => {
      captured.push({
        action,
        mergeRequestId: event.mergeRequest.id,
        status: event.mergeRequest.status
      });
    })
  );

  return {
    for: (mergeRequestId: string) =>
      captured.filter(event => event.mergeRequestId === mergeRequestId),
    stop: () => unsubscribers.forEach(unsubscribe => unsubscribe())
  };
};

describe('module-skill-merge-requests merge flow', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it(
    'merges a fork change into the upstream and records every step',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let resourceActor = await ensureResourceActor(fixture);
      let authorization = createResourceAuthorization({ restricted: false, resourceActor });
      let { upstream, fork } = await createForkPair(fixture);
      let path = uniquePath('guide');
      let content = '# Guide\n\nWritten in the fork';
      await addDocument(fixture, fork, path, content);

      let audit = captureAuditEvents();
      try {
        let mergeRequest = await openMergeRequest(fixture, fork, { authorization });
        expect(mergeRequest).toMatchObject({
          status: 'open',
          direction: 'fork_to_upstream',
          baseStrategy: 'exact',
          baseTargetSkillVersionOid: fork.forkedFromSkillVersionOid,
          baseSourceSkillVersionOid: fork.forkedFromSkillVersionOid,
          mergedAt: null,
          closedAt: null
        });
        expect(mergeRequest.activePairKey).toBeTruthy();
        expect(mergeRequest.createdByResourceActor?.id).toBe(resourceActor.id);
        expect(mergeRequest.sourceSkill.id).toBe(fork.id);
        expect(mergeRequest.targetSkill.id).toBe(upstream.id);

        expect(await documentItemPaths(mergeRequest)).toEqual([path]);
        let item = await getItemByPath(mergeRequest, path);
        expect(item).toMatchObject({
          kind: 'document',
          changeType: 'added',
          status: 'resolved',
          resolutionType: 'accept_source',
          conflictReason: null
        });

        let plan = await skillMergeRequestService.getSkillMergePlan({ mergeRequest });
        let planned = plan.items.find(entry => entry.item.path === path);
        expect(planned?.documentMerge).toEqual({
          baseContent: undefined,
          sourceContent: content,
          targetContent: undefined,
          hasConflict: false
        });

        let merged = await mergeAndWait(fixture, mergeRequest, authorization);
        expect(merged).toMatchObject({
          status: 'merged',
          mergeError: null,
          mergeErrorCode: null,
          activePairKey: null,
          mergeStartedByResourceActorOid: resourceActor.oid,
          mergedByResourceActorOid: resourceActor.oid
        });
        expect(merged.mergedAt).toBeInstanceOf(Date);
        expect(merged.preMergeTargetSkillVersionOid).not.toBeNull();
        expect(merged.mergedTargetSkillVersionOid).not.toBeNull();

        expect(await readDocument(fixture, upstream, path)).toBe(content);
        expect(await readDocument(fixture, fork, path)).toBe(content);

        let appliedItem = await getItemByPath(mergeRequest, path);
        expect(appliedItem.status).toBe('applied');
        expect(appliedItem.appliedAt).toBeInstanceOf(Date);

        expect(await eventTypes(mergeRequest)).toEqual([
          'created',
          'merge_started',
          'merge_completed'
        ]);

        let completed = await firstPage(
          await skillMergeRequestEventService.listEvents({
            ...scopeOf(fixture),
            authorization,
            mergeRequest,
            types: ['merge_completed']
          })
        );
        expect(completed).toHaveLength(1);
        expect(completed[0]!.resourceActor?.id).toBe(resourceActor.id);

        let fetchedEvent = await skillMergeRequestEventService.getEventById({
          ...scopeOf(fixture),
          authorization,
          mergeRequest,
          eventId: completed[0]!.id
        });
        expect(fetchedEvent.type).toBe('merge_completed');

        expect(audit.for(mergeRequest.id).map(event => event.action)).toEqual([
          'created',
          'merged'
        ]);
      } finally {
        audit.stop();
      }
    },
    flowTimeout
  );

  it(
    'rejects transitions of closed and merged merge requests',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let { fork } = await createForkPair(fixture);
      let path = uniquePath('closed');
      await addDocument(fixture, fork, path, 'closed change');

      let audit = captureAuditEvents();
      try {
        let opened = await openMergeRequest(fixture, fork);
        let item = await getItemByPath(opened, path);

        let closed = await skillMergeRequestService.closeSkillMergeRequest({
          ...scopeOf(fixture),
          auditScope: fixture.auditScope,
          authorization: privileged,
          mergeRequest: opened
        });
        expect(closed.status).toBe('closed');
        expect(audit.for(opened.id).map(event => event.action)).toEqual(['created', 'closed']);

        let mergeClosed = await expectServiceError(
          skillMergeRequestService.performSkillMergeRequest({
            ...scopeOf(fixture),
            authorization: privileged,
            mergeRequest: closed
          }),
          'bad_request'
        );
        expect(mergeClosed.message).toMatch(/Only open merge requests can merge/);

        let mergeStale = await expectServiceError(
          skillMergeRequestService.performSkillMergeRequest({
            ...scopeOf(fixture),
            authorization: privileged,
            mergeRequest: opened
          }),
          'bad_request'
        );
        expect(mergeStale.message).toMatch(/no longer open/);

        let resolveClosed = await expectServiceError(
          skillMergeRequestService.saveSkillMergeRequestItemResolution({
            ...scopeOf(fixture),
            authorization: privileged,
            mergeRequest: closed,
            itemId: item.id,
            resolutionType: 'skip'
          }),
          'bad_request'
        );
        expect(resolveClosed.message).toMatch(/Only open merge requests can change/);

        await expectServiceError(
          skillMergeRequestService.rollbackSkillMergeRequest({
            ...scopeOf(fixture),
            auditScope: fixture.auditScope,
            authorization: privileged,
            mergeRequest: closed
          }),
          'bad_request'
        );

        let row = await db.skillMergeRequest.findUniqueOrThrow({ where: { id: opened.id } });
        expect(row.status).toBe('closed');
        expect(await eventTypes(opened)).toEqual(['created', 'closed']);
        expect((await getItemByPath(opened, path)).resolutionType).toBe('accept_source');

        let reopened = await openMergeRequest(fixture, fork);
        expect(reopened.id).not.toBe(opened.id);
        expect(reopened.status).toBe('open');

        await mergeAndWait(fixture, reopened);
        let merged = await getMergeRequest(fixture, reopened.id);
        expect(merged.status).toBe('merged');

        await expectServiceError(
          skillMergeRequestService.performSkillMergeRequest({
            ...scopeOf(fixture),
            authorization: privileged,
            mergeRequest: merged
          }),
          'bad_request'
        );
        let closeMerged = await expectServiceError(
          skillMergeRequestService.closeSkillMergeRequest({
            ...scopeOf(fixture),
            auditScope: fixture.auditScope,
            authorization: privileged,
            mergeRequest: merged
          }),
          'bad_request'
        );
        expect(closeMerged.message).toMatch(/Only open merge requests can close/);

        let nothingLeft = await expectServiceError(
          openMergeRequest(fixture, fork),
          'bad_request'
        );
        expect(nothingLeft.message).toBe('The source skill has no changes to merge');
      } finally {
        audit.stop();
      }
    },
    flowTimeout
  );

  it(
    'rolls back a merge and lets the fork propose the change again',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let { upstream, fork } = await createForkPair(fixture);
      let path = uniquePath('rollback');
      await addDocument(fixture, fork, path, 'rolled back change');

      let opened = await openMergeRequest(fixture, fork);
      await mergeAndWait(fixture, opened);
      expect(await readDocument(fixture, upstream, path)).toBe('rolled back change');

      let audit = captureAuditEvents();
      try {
        let rolledBack = await skillMergeRequestService.rollbackSkillMergeRequest({
          ...scopeOf(fixture),
          auditScope: fixture.auditScope,
          authorization: privileged,
          mergeRequest: await getMergeRequest(fixture, opened.id)
        });
        expect(rolledBack.status).toBe('merged');
        expect(rolledBack.rolledBackAt).toBeInstanceOf(Date);
        expect(rolledBack.rollbackTargetSkillVersionOid).not.toBeNull();
        expect(audit.for(opened.id).map(event => event.action)).toEqual(['rolled_back']);
      } finally {
        audit.stop();
      }

      expect(await findStoreItem(upstream, path)).toBeNull();
      expect(await readDocument(fixture, fork, path)).toBe('rolled back change');
      expect(await eventTypes(opened)).toEqual([
        'created',
        'merge_started',
        'merge_completed',
        'rolled_back'
      ]);

      let rollbackAgain = await expectServiceError(
        skillMergeRequestService.rollbackSkillMergeRequest({
          ...scopeOf(fixture),
          auditScope: fixture.auditScope,
          authorization: privileged,
          mergeRequest: await getMergeRequest(fixture, opened.id)
        }),
        'bad_request'
      );
      expect(rollbackAgain.message).toMatch(/Only unrolled-back merged requests/);

      let proposedAgain = await openMergeRequest(fixture, fork);
      expect(proposedAgain.baseStrategy).toBe('exact');
      expect(proposedAgain.baseSourceSkillVersionOid).toBe(fork.forkedFromSkillVersionOid);
      expect(await documentItemPaths(proposedAgain)).toEqual([path]);

      await expectServiceError(
        skillMergeRequestService.rollbackSkillMergeRequest({
          ...scopeOf(fixture),
          auditScope: fixture.auditScope,
          authorization: privileged,
          mergeRequest: proposedAgain
        }),
        'bad_request'
      );

      let remerged = await mergeAndWait(fixture, proposedAgain);
      expect(remerged.status).toBe('merged');
      expect(await readDocument(fixture, upstream, path)).toBe('rolled back change');
    },
    flowTimeout
  );

  it('replaces the open merge request of the same fork and filters listings', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { upstream, fork } = await createForkPair(fixture);
    let firstPath = uniquePath('first');
    let secondPath = uniquePath('second');
    await addDocument(fixture, fork, firstPath, 'first change');

    let first = await openMergeRequest(fixture, fork);
    await addDocument(fixture, fork, secondPath, 'second change');
    let second = await skillMergeRequestService.createSkillMergeRequest({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      sourceSkillId: fork.id,
      targetSkillId: upstream.id,
      title: 'Second proposal'
    });

    let replaced = await db.skillMergeRequest.findUniqueOrThrow({ where: { id: first.id } });
    expect(replaced.status).toBe('closed');
    expect(replaced.closedAt).toBeInstanceOf(Date);
    expect(replaced.activePairKey).toBeNull();
    expect(await eventTypes(first)).toEqual(['created', 'closed']);

    expect(second.status).toBe('open');
    expect(second.activePairKey).toBe(first.activePairKey);
    expect((await documentItemPaths(second)).sort()).toEqual([firstPath, secondPath].sort());

    let list = async (
      filter: Omit<
        Parameters<typeof skillMergeRequestService.listSkillMergeRequests>[0],
        'project' | 'instance' | 'authorization'
      >
    ) =>
      (
        await firstPage(
          await skillMergeRequestService.listSkillMergeRequests({
            ...scopeOf(fixture),
            authorization: privileged,
            ...filter
          })
        )
      ).map(item => item.id);

    expect(await list({ sourceSkillIds: [fork.id], statuses: ['open'] })).toEqual([second.id]);
    expect(await list({ sourceSkillIds: [fork.id], statuses: ['closed'] })).toEqual([
      first.id
    ]);
    expect(await list({ targetSkillIds: [upstream.id] })).toEqual([second.id, first.id]);
    expect(await list({ ids: [first.id], statuses: ['open'] })).toEqual([]);
    expect(await list({ sourceSkillIds: [upstream.id] })).toEqual([]);
  });

  it(
    'only proposes fork changes when the upstream moved on since the fork',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let { upstream, fork } = await createForkPair(fixture);
      let upstreamPath = uniquePath('upstream-only');
      let forkPath = uniquePath('fork-only');
      await addDocument(fixture, upstream, upstreamPath, 'upstream change');
      await addDocument(fixture, fork, forkPath, 'fork change');

      let mergeRequest = await openMergeRequest(fixture, fork);
      expect(mergeRequest.baseStrategy).toBe('exact');
      expect(await documentItemPaths(mergeRequest)).toEqual([forkPath]);

      await mergeAndWait(fixture, mergeRequest);
      expect(await readDocument(fixture, upstream, upstreamPath)).toBe('upstream change');
      expect(await readDocument(fixture, upstream, forkPath)).toBe('fork change');
      expect(await findStoreItem(fork, upstreamPath)).toBeNull();

      let nextPath = uniquePath('next');
      await addDocument(fixture, fork, nextPath, 'next change');
      let next = await openMergeRequest(fixture, fork);
      expect(next.baseStrategy).toBe('inferred_current');
      expect(await documentItemPaths(next)).toEqual([nextPath]);
    },
    flowTimeout
  );

  it(
    'requires conflicts to be resolved before merging',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let { upstream, fork } = await createForkPair(fixture);
      let path = uniquePath('conflict');
      await addDocument(fixture, fork, path, 'fork version');
      await addDocument(fixture, upstream, path, 'upstream version');

      let mergeRequest = await openMergeRequest(fixture, fork);
      let item = await getItemByPath(mergeRequest, path);
      expect(item).toMatchObject({
        changeType: 'conflicted',
        status: 'unresolved',
        resolutionType: null,
        conflictReason: 'source_and_target_changed'
      });

      let plan = await skillMergeRequestService.getSkillMergePlan({ mergeRequest });
      expect(plan.items.find(entry => entry.item.id === item.id)?.documentMerge).toMatchObject(
        {
          sourceContent: 'fork version',
          targetContent: 'upstream version',
          hasConflict: true
        }
      );

      let unresolved = await expectServiceError(
        skillMergeRequestService.performSkillMergeRequest({
          ...scopeOf(fixture),
          authorization: privileged,
          mergeRequest
        }),
        'bad_request'
      );
      expect(unresolved.message).toMatch(/Resolve all merge request conflicts/);
      expect(
        (await db.skillMergeRequest.findUniqueOrThrow({ where: { id: mergeRequest.id } }))
          .status
      ).toBe('open');

      let resolve = (
        resolutionType: Parameters<
          typeof skillMergeRequestService.saveSkillMergeRequestItemResolution
        >[0]['resolutionType'],
        resolution?: Prisma.InputJsonValue,
        itemId = item.id
      ) =>
        skillMergeRequestService.saveSkillMergeRequestItemResolution({
          ...scopeOf(fixture),
          authorization: privileged,
          mergeRequest,
          itemId,
          resolutionType,
          resolution
        });

      for (let [resolutionType, resolution] of [
        ['replace_file', { fileId: 'file_does_not_exist' }],
        ['remove', undefined],
        ['edit_document', undefined],
        ['edit_document', { content: 'merged', title: 42 }]
      ] as const) {
        await expectServiceError(resolve(resolutionType, resolution), 'bad_request');
      }
      await expectServiceError(
        resolve('accept_source', undefined, 'skmri_missing'),
        'not_found'
      );
      await expectServiceError(
        skillMergeRequestService.bulkSaveSkillMergeRequestItemResolutions({
          ...scopeOf(fixture),
          authorization: privileged,
          mergeRequest,
          items: [
            { itemId: item.id, resolutionType: 'accept_source' },
            { itemId: item.id, resolutionType: 'keep_target' }
          ]
        }),
        'bad_request'
      );
      expect((await getItemByPath(mergeRequest, path)).status).toBe('unresolved');

      let resolved = await resolve('edit_document', { content: 'merged version' });
      expect(resolved).toMatchObject({ status: 'resolved', resolutionType: 'edit_document' });
      expect(resolved.resolvedAt).toBeInstanceOf(Date);

      let merged = await mergeAndWait(fixture, mergeRequest);
      expect(merged.status).toBe('merged');
      expect(await readDocument(fixture, upstream, path)).toBe('merged version');
      expect(await readDocument(fixture, fork, path)).toBe('fork version');
      expect(await eventTypes(mergeRequest)).toEqual([
        'created',
        'all_conflicts_resolved',
        'merge_started',
        'merge_completed'
      ]);
    },
    flowTimeout
  );

  it(
    'applies bulk resolutions and keeps the target where asked',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let { upstream, fork } = await createForkPair(fixture);
      let keptPath = uniquePath('kept');
      let acceptedPath = uniquePath('accepted');
      for (let path of [keptPath, acceptedPath]) {
        await addDocument(fixture, fork, path, `fork ${path}`);
        await addDocument(fixture, upstream, path, `upstream ${path}`);
      }

      let mergeRequest = await openMergeRequest(fixture, fork);
      let kept = await getItemByPath(mergeRequest, keptPath);
      let accepted = await getItemByPath(mergeRequest, acceptedPath);

      let saved = await skillMergeRequestService.bulkSaveSkillMergeRequestItemResolutions({
        ...scopeOf(fixture),
        authorization: privileged,
        mergeRequest,
        items: [
          { itemId: kept.id, resolutionType: 'keep_target' },
          { itemId: accepted.id, resolutionType: 'accept_source' }
        ]
      });
      expect(Object.fromEntries(saved.map(item => [item.path, item.status]))).toEqual({
        [keptPath]: 'skipped',
        [acceptedPath]: 'resolved'
      });
      expect(await eventTypes(mergeRequest)).toEqual(['created', 'all_conflicts_resolved']);

      await mergeAndWait(fixture, mergeRequest);
      expect(await readDocument(fixture, upstream, keptPath)).toBe(`upstream ${keptPath}`);
      expect(await readDocument(fixture, upstream, acceptedPath)).toBe(`fork ${acceptedPath}`);
      expect((await getItemByPath(mergeRequest, keptPath)).status).toBe('skipped');
      expect((await getItemByPath(mergeRequest, acceptedPath)).status).toBe('applied');
    },
    flowTimeout
  );

  it(
    'reopens the merge for review when the target changed after it was opened',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let { upstream, fork } = await createForkPair(fixture);
      let path = uniquePath('raced');
      await addDocument(fixture, fork, path, 'fork version');

      let mergeRequest = await openMergeRequest(fixture, fork);
      expect((await getItemByPath(mergeRequest, path)).status).toBe('resolved');
      await addDocument(fixture, upstream, path, 'upstream version');

      let failed = await mergeAndWait(fixture, mergeRequest);
      expect(failed).toMatchObject({
        status: 'open',
        mergeErrorCode: 'unresolved_after_refresh',
        mergeStartedAt: null,
        mergedAt: null
      });
      expect(failed.mergeError).toMatch(/target skill changed/);
      expect(failed.requestedTargetSkillVersionOid).not.toBe(
        mergeRequest.requestedTargetSkillVersionOid
      );

      let item = await getItemByPath(mergeRequest, path);
      expect(item).toMatchObject({ changeType: 'conflicted', status: 'unresolved' });
      expect(await readDocument(fixture, upstream, path)).toBe('upstream version');

      let failedEvent = await db.skillMergeRequestEvent.findFirstOrThrow({
        where: { skillMergeRequestOid: mergeRequest.oid, type: 'merge_failed' }
      });
      expect(failedEvent.errorCode).toBe('unresolved_after_refresh');
      expect(await eventTypes(mergeRequest)).toEqual([
        'created',
        'merge_started',
        'merge_failed'
      ]);

      let refreshed = await getMergeRequest(fixture, mergeRequest.id);
      await skillMergeRequestService.saveSkillMergeRequestItemResolution({
        ...scopeOf(fixture),
        authorization: privileged,
        mergeRequest: refreshed,
        itemId: item.id,
        resolutionType: 'keep_target'
      });

      let merged = await mergeAndWait(fixture, refreshed);
      expect(merged).toMatchObject({
        status: 'merged',
        mergeError: null,
        mergeErrorCode: null
      });
      expect(await readDocument(fixture, upstream, path)).toBe('upstream version');
    },
    flowTimeout
  );

  it('validates the source and target of a new merge request', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { upstream, fork } = await createForkPair(fixture);
    let unrelated = await createSkill(fixture);
    await addDocument(fixture, fork, uniquePath('valid'), 'change');

    let wrongTarget = await expectServiceError(
      skillMergeRequestService.createSkillMergeRequest({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        sourceSkillId: fork.id,
        targetSkillId: unrelated.id,
        title: 'Wrong target'
      }),
      'bad_request'
    );
    expect(wrongTarget.message).toBe('Source skill must be a fork of the target skill');

    await expectServiceError(
      skillMergeRequestService.createSkillMergeRequest({
        ...scopeOf(fixture),
        auditScope: fixture.auditScope,
        authorization: privileged,
        sourceSkillId: 'skl_does_not_exist',
        title: 'Unknown source'
      }),
      'not_found'
    );

    await skillService.archiveSkill({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      skill: upstream
    });
    let archivedUpstream = await expectServiceError(
      openMergeRequest(fixture, fork),
      'bad_request'
    );
    expect(archivedUpstream.message).toBe('Source skill does not have an upstream skill');

    expect(await db.skillMergeRequest.count({ where: { sourceSkill: { id: fork.id } } })).toBe(
      0
    );
  });

  it('does not expose merge requests or skills to another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let { upstream, fork } = await createForkPair(fixture);
    let path = uniquePath('isolated');
    await addDocument(fixture, fork, path, 'change');
    let mergeRequest = await openMergeRequest(fixture, fork);
    let item = await getItemByPath(mergeRequest, path);

    await expectServiceError(getMergeRequest(other, mergeRequest.id), 'not_found');
    await expectServiceError(
      skillMergeRequestService.closeSkillMergeRequest({
        ...scopeOf(other),
        auditScope: other.auditScope,
        authorization: privileged,
        mergeRequest
      }),
      'not_found'
    );
    await expectServiceError(
      skillMergeRequestService.saveSkillMergeRequestItemResolution({
        ...scopeOf(other),
        authorization: privileged,
        mergeRequest,
        itemId: item.id,
        resolutionType: 'skip'
      }),
      'not_found'
    );
    await expectServiceError(openMergeRequest(other, fork), 'not_found');

    let listed = await firstPage(
      await skillMergeRequestService.listSkillMergeRequests({
        ...scopeOf(other),
        authorization: privileged,
        ids: [mergeRequest.id]
      })
    );
    expect(listed).toEqual([]);

    let bySkill = await firstPage(
      await skillMergeRequestService.listSkillMergeRequests({
        ...scopeOf(other),
        authorization: privileged,
        sourceSkillIds: [fork.id],
        targetSkillIds: [upstream.id]
      })
    );
    expect(bySkill).toEqual([]);

    let row = await db.skillMergeRequest.findUniqueOrThrow({ where: { id: mergeRequest.id } });
    expect(row.status).toBe('open');
    expect(await eventTypes(mergeRequest)).toEqual(['created']);
  });
});
