import { firstPage, rejectionOf, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { skillService } from '@metorial/module-skill';
import { storeItemMutationService } from '@metorial/module-store';
import { describe, expect, it } from 'vitest';
import { skillMergeRequestEventService, skillMergeRequestService } from '../src';

let authorization = createResourceAuthorization({ restricted: false });

let createSkill = async (
  fixture: OrganizationFixture,
  parentSkill?: Awaited<ReturnType<typeof skillService.createSkill>>
) =>
  await skillService.createSkill({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    parentSkill,
    parentSkillCloneType: parentSkill ? 'fork' : undefined,
    input: {
      id: await ID.generateId('skill'),
      authorization,
      name: uniqueId(parentSkill ? 'fork' : 'upstream')
    }
  });

describe('module-skill-merge-requests', () => {
  let org = useOrganization();

  it('rejects merge requests without a title, upstream or changes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let upstream = await createSkill(fixture);
    let fork = await createSkill(fixture, upstream);
    expect(fork.forkedFromSkillVersionOid).not.toBeNull();

    let emptyTitle = await rejectionOf(
      skillMergeRequestService.createSkillMergeRequest({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        authorization,
        sourceSkillId: fork.id,
        title: '   '
      })
    );
    expect(emptyTitle.data.code).toBe('bad_request');

    let noUpstream = await rejectionOf(
      skillMergeRequestService.createSkillMergeRequest({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        authorization,
        sourceSkillId: upstream.id,
        title: 'No upstream'
      })
    );
    expect(noUpstream.data.message).toBe('Source skill does not have an upstream skill');

    let noChanges = await rejectionOf(
      skillMergeRequestService.createSkillMergeRequest({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        authorization,
        sourceSkillId: fork.id,
        title: 'No changes'
      })
    );
    expect(noChanges.data.message).toBe('The source skill has no changes to merge');
  });

  it('opens, gets, lists, plans and closes a merge request from a fork', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let upstream = await createSkill(fixture);
    let fork = await createSkill(fixture, upstream);

    await storeItemMutationService.modifyStoreItems({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      store: fork.store!,
      operations: [{ type: 'add', path: '/references/' }]
    });

    let title = uniqueId('merge-request');
    let mergeRequest = await skillMergeRequestService.createSkillMergeRequest({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      authorization,
      sourceSkillId: fork.id,
      title,
      description: 'Created by the e2e suite'
    });
    expect(mergeRequest.title).toBe(title);
    expect(mergeRequest.status).toBe('open');
    expect(mergeRequest.direction).toBe('fork_to_upstream');
    expect(mergeRequest.sourceSkill.id).toBe(fork.id);
    expect(mergeRequest.targetSkill.id).toBe(upstream.id);
    expect(mergeRequest.baseStrategy).toBe('exact');

    let fetched = await skillMergeRequestService.getSkillMergeRequestById({
      project: fixture.project,
      instance: fixture.instance,
      authorization,
      skillMergeRequestId: mergeRequest.id
    });
    expect(fetched.id).toBe(mergeRequest.id);

    let listed = await firstPage(
      await skillMergeRequestService.listSkillMergeRequests({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        sourceSkillIds: [fork.id],
        statuses: ['open']
      })
    );
    expect(listed.map(item => item.id)).toEqual([mergeRequest.id]);

    let plan = await skillMergeRequestService.getSkillMergePlan({ mergeRequest: fetched });
    let references = plan.items.find(entry => entry.item.path === '/references/');
    expect(references?.item.changeType).toBe('added');
    expect(references?.item.status).toBe('resolved');
    expect(references?.item.resolutionType).toBe('accept_source');

    let closed = await skillMergeRequestService.closeSkillMergeRequest({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      authorization,
      mergeRequest: fetched
    });
    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBeInstanceOf(Date);
    expect(closed.activePairKey).toBeNull();

    let events = await firstPage(
      await skillMergeRequestEventService.listEvents({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        mergeRequest: closed
      })
    );
    expect(events.map(event => event.type).sort()).toEqual(['closed', 'created']);

    let closeAgain = await rejectionOf(
      skillMergeRequestService.closeSkillMergeRequest({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        authorization,
        mergeRequest: closed
      })
    );
    expect(closeAgain.data.code).toBe('bad_request');

    let stored = await db.skillMergeRequest.findUniqueOrThrow({
      where: { id: mergeRequest.id }
    });
    expect(stored.status).toBe('closed');
  });

  it('returns not found for an unknown merge request', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let error = await rejectionOf(
      skillMergeRequestService.getSkillMergeRequestById({
        project: fixture.project,
        instance: fixture.instance,
        authorization,
        skillMergeRequestId: 'skmr_does_not_exist'
      })
    );
    expect(error.data.code).toBe('not_found');
  });
});
