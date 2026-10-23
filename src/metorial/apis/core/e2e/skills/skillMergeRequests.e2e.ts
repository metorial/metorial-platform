import {
  eventually,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMember,
  useOrganization,
  type RestClient
} from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  addDocument,
  badRequest,
  createSkill,
  dashboardApi,
  expectResponses,
  expectRoutesAuth,
  forbidden,
  forkSkillInProcess,
  getRoute,
  ids,
  invalid,
  listAuth,
  managementApi,
  memberApi,
  notFound,
  resourceAuth,
  skillClients,
  uniquePath
} from './_shared';

let mergeTimeout = { timeoutMs: 90_000, intervalMs: 500 };

describe('api-core skill merge requests', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let createForkWithChanges = async (paths: string[] = [uniquePath('change')]) => {
    let fixture = await loadOrganizationFixture(org.ids);
    let upstream = await createSkill(org.clients.instance);
    let fork = await forkSkillInProcess(fixture, upstream.id);
    for (let path of paths) await addDocument(fixture, fork.id, path, `content of ${path}`);

    return { fixture, upstream, fork, paths };
  };

  let openMergeRequest = async (
    client: RestClient,
    forkId: string,
    body: Record<string, unknown> = {}
  ) =>
    expectOk(
      await client.post('/skill-merge-requests', {
        source_skill_id: forkId,
        title: uniqueId('e2e-merge-request'),
        ...body
      })
    );

  let waitForMerge = (client: RestClient, mergeRequestId: string) =>
    eventually(async () => {
      let mergeRequest = expectOk(await client.get(`/skill-merge-requests/${mergeRequestId}`));
      expect(mergeRequest.status).not.toBe('merging');
      return mergeRequest;
    }, mergeTimeout);

  describe('merge requests', () => {
    it('opens, plans, resolves, merges and rolls back a merge request', async () => {
      let api = org.clients.instance;
      let { upstream, fork, paths } = await createForkWithChanges([
        uniquePath('first'),
        uniquePath('second')
      ]);

      let mergeRequest = await openMergeRequest(api, fork.id, {
        title: 'Bring the fork upstream',
        description: 'Opened over REST'
      });
      expectPresented(mergeRequest, 'skill.merge_request');
      expect(mergeRequest).toMatchObject({
        status: 'open',
        title: 'Bring the fork upstream',
        description: 'Opened over REST',
        source_skill_id: fork.id,
        target_skill_id: upstream.id,
        comment_count: 0,
        merged_at: null,
        closed_at: null
      });
      expect(mergeRequest.item_count).toBeGreaterThanOrEqual(2);

      let fetched = expectOk(await api.get(`/skill-merge-requests/${mergeRequest.id}`));
      expect(fetched).toMatchObject({ id: mergeRequest.id, status: 'open' });

      let plan = expectOk(await api.get(`/skill-merge-requests/${mergeRequest.id}/plan`));
      expectPresented(plan, 'skill.merge_plan');
      expect(plan.merge_request.id).toBe(mergeRequest.id);

      let planPaths = plan.items.map((entry: any) => entry.item.path);
      expect(planPaths).toEqual(expect.arrayContaining(paths));

      let [firstItem, secondItem] = paths.map(
        path => plan.items.find((entry: any) => entry.item.path === path).item
      );
      expectPresented(firstItem, 'skill.merge_request.item');

      let skipped = expectOk(
        await api.patch(`/skill-merge-requests/${mergeRequest.id}/items/${secondItem.id}`, {
          resolution_type: 'skip'
        })
      );
      expectPresented(skipped, 'skill.merge_request.item');
      expect(skipped).toMatchObject({ id: secondItem.id, resolution_type: 'skip' });

      let bulk = expectOk(
        await api.patch(`/skill-merge-requests/${mergeRequest.id}/items`, {
          items: [{ item_id: firstItem.id, resolution_type: 'accept_source' }]
        })
      );
      expect(bulk.items.map((item: any) => [item.id, item.resolution_type])).toEqual([
        [firstItem.id, 'accept_source']
      ]);

      let started = expectOk(
        await api.post(`/skill-merge-requests/${mergeRequest.id}/perform`)
      );
      expect(started.status).toBe('merging');

      let merged = await waitForMerge(api, mergeRequest.id);
      expect(merged).toMatchObject({ status: 'merged', rolled_back_at: null });
      expect(merged.merged_at).not.toBeNull();
      expect(merged.merged_target_skill_version_id).not.toBeNull();

      let rolledBack = expectOk(
        await api.post(`/skill-merge-requests/${mergeRequest.id}/rollback`)
      );
      expectPresented(rolledBack, 'skill.merge_request');
      expect(rolledBack.status).toBe('merged');
      expect(rolledBack.rolled_back_at).not.toBeNull();
      expect(rolledBack.rollback_target_skill_version_id).not.toBeNull();

      let events = await listAll(api, `/skill-merge-requests/${mergeRequest.id}/events`);
      expect(events.map(event => event.type)).toEqual([
        'created',
        'merge_started',
        'merge_completed',
        'rolled_back'
      ]);
      for (let event of events) expectPresented(event, 'skill.merge_request.event');

      let event = expectOk(
        await api.get(`/skill-merge-requests/${mergeRequest.id}/events/${events[0].id}`)
      );
      expect(event).toMatchObject({ id: events[0].id, type: 'created' });

      let completed = await listAll(api, `/skill-merge-requests/${mergeRequest.id}/events`, {
        query: { type: 'merge_completed' }
      });
      expect(completed.map(item => item.type)).toEqual(['merge_completed']);

      await expectResponses([
        badRequest('roll back twice', () =>
          api.post(`/skill-merge-requests/${mergeRequest.id}/rollback`)
        ),
        badRequest('perform a merged request', () =>
          api.post(`/skill-merge-requests/${mergeRequest.id}/perform`)
        ),
        badRequest('close a merged request', () =>
          api.post(`/skill-merge-requests/${mergeRequest.id}/close`)
        ),
        badRequest('resolve an item of a merged request', () =>
          api.patch(`/skill-merge-requests/${mergeRequest.id}/items/${firstItem.id}`, {
            resolution_type: 'skip'
          })
        )
      ]);
    }, 180_000);

    it('closes a merge request and rejects further transitions', async () => {
      let api = org.clients.instance;
      let { fork } = await createForkWithChanges();
      let mergeRequest = await openMergeRequest(api, fork.id);
      let plan = expectOk(await api.get(`/skill-merge-requests/${mergeRequest.id}/plan`));
      let item = plan.items[0].item;

      let closed = expectOk(await api.post(`/skill-merge-requests/${mergeRequest.id}/close`));
      expectPresented(closed, 'skill.merge_request');
      expect(closed.status).toBe('closed');
      expect(closed.closed_at).not.toBeNull();

      await expectResponses([
        badRequest('close twice', () =>
          api.post(`/skill-merge-requests/${mergeRequest.id}/close`)
        ),
        badRequest('perform a closed request', () =>
          api.post(`/skill-merge-requests/${mergeRequest.id}/perform`)
        ),
        badRequest('roll back a closed request', () =>
          api.post(`/skill-merge-requests/${mergeRequest.id}/rollback`)
        ),
        badRequest('resolve an item of a closed request', () =>
          api.patch(`/skill-merge-requests/${mergeRequest.id}/items/${item.id}`, {
            resolution_type: 'skip'
          })
        )
      ]);

      let events = await listAll(api, `/skill-merge-requests/${mergeRequest.id}/events`);
      expect(events.map(event => event.type)).toEqual(['created', 'closed']);

      let reopened = await openMergeRequest(api, fork.id);
      expect(reopened.id).not.toBe(mergeRequest.id);
      expect(reopened.status).toBe('open');
    });

    it('filters merge requests by id, skills and status', async () => {
      let api = org.clients.instance;
      let first = await createForkWithChanges();
      let second = await createForkWithChanges();
      let open = await openMergeRequest(api, first.fork.id);
      let closed = await openMergeRequest(api, second.fork.id);
      expectOk(await api.post(`/skill-merge-requests/${closed.id}/close`));

      let bySource = await listAll(api, '/skill-merge-requests', {
        query: { source_skill_id: first.fork.id }
      });
      expect(ids(bySource)).toEqual([open.id]);

      let byTarget = await listAll(api, '/skill-merge-requests', {
        query: { target_skill_id: second.upstream.id }
      });
      expect(ids(byTarget)).toEqual([closed.id]);

      let openOnly = await listAll(api, '/skill-merge-requests', {
        query: { status: 'open' }
      });
      expect(ids(openOnly)).toContain(open.id);
      expect(ids(openOnly)).not.toContain(closed.id);

      let closedOnly = await listAll(api, '/skill-merge-requests', {
        query: { status: 'closed' }
      });
      expect(ids(closedOnly)).toContain(closed.id);
      expect(ids(closedOnly)).not.toContain(open.id);

      let byId = await listAll(api, '/skill-merge-requests', { query: { id: closed.id } });
      expect(ids(byId)).toEqual([closed.id]);

      let otherList = await listAll(otherOrg.clients.instance, '/skill-merge-requests');
      expect(ids(otherList)).not.toContain(open.id);
    });

    it('rejects merge requests between unrelated skills or without changes', async () => {
      let api = org.clients.instance;
      let fixture = await loadOrganizationFixture(org.ids);
      let upstream = await createSkill(api);
      let unchangedFork = await forkSkillInProcess(fixture, upstream.id);
      let duplicate = expectOk(
        await api.post(`/skills/${upstream.id}/duplicate`, { name: uniqueId('duplicate') })
      );
      let unrelated = await createSkill(api);
      let { fork } = await createForkWithChanges();
      let foreignSkill = await createSkill(otherOrg.clients.instance);

      await expectResponses([
        invalid('create without a title', () =>
          api.post('/skill-merge-requests', { source_skill_id: fork.id })
        ),
        invalid('create without a source', () =>
          api.post('/skill-merge-requests', { title: 'x' })
        ),
        invalid('create with a numeric target', () =>
          api.post('/skill-merge-requests', {
            source_skill_id: fork.id,
            title: 'x',
            target_skill_id: 1
          })
        ),
        invalid('list with an unknown status', () =>
          api.get('/skill-merge-requests', { query: { status: 'pending' } })
        ),
        badRequest('create from a skill without upstream', () =>
          api.post('/skill-merge-requests', { source_skill_id: upstream.id, title: 'x' })
        ),
        badRequest('create from a fork without changes', () =>
          api.post('/skill-merge-requests', { source_skill_id: unchangedFork.id, title: 'x' })
        ),
        badRequest('create from a duplicate without a fork base', () =>
          api.post('/skill-merge-requests', { source_skill_id: duplicate.id, title: 'x' })
        ),
        badRequest('create into a skill that is not the upstream', () =>
          api.post('/skill-merge-requests', {
            source_skill_id: fork.id,
            target_skill_id: unrelated.id,
            title: 'x'
          })
        ),
        notFound('create from another organization skill', () =>
          api.post('/skill-merge-requests', { source_skill_id: foreignSkill.id, title: 'x' })
        ),
        notFound('create into another organization skill', () =>
          api.post('/skill-merge-requests', {
            source_skill_id: fork.id,
            target_skill_id: foreignSkill.id,
            title: 'x'
          })
        ),
        notFound('unknown merge request', () => api.get('/skill-merge-requests/skmr_missing'))
      ]);

      expect(
        await listAll(api, '/skill-merge-requests', { query: { source_skill_id: fork.id } })
      ).toEqual([]);
    });

    it('rejects invalid item resolutions', async () => {
      let api = org.clients.instance;
      let { fork } = await createForkWithChanges();
      let mergeRequest = await openMergeRequest(api, fork.id);
      let plan = expectOk(await api.get(`/skill-merge-requests/${mergeRequest.id}/plan`));
      let item = plan.items[0].item;
      let other = await createForkWithChanges();
      let otherMergeRequest = await openMergeRequest(api, other.fork.id);
      let otherPlan = expectOk(
        await api.get(`/skill-merge-requests/${otherMergeRequest.id}/plan`)
      );
      let otherItem = otherPlan.items[0].item;

      await expectResponses([
        invalid('resolve without a resolution type', () =>
          api.patch(`/skill-merge-requests/${mergeRequest.id}/items/${item.id}`, {})
        ),
        invalid('resolve with an unknown resolution type', () =>
          api.patch(`/skill-merge-requests/${mergeRequest.id}/items/${item.id}`, {
            resolution_type: 'squash'
          })
        ),
        invalid('resolve with string resolution', () =>
          api.patch(`/skill-merge-requests/${mergeRequest.id}/items/${item.id}`, {
            resolution_type: 'edit_document',
            resolution: 'new content'
          })
        ),
        invalid('bulk resolve without items', () =>
          api.patch(`/skill-merge-requests/${mergeRequest.id}/items`, {})
        ),
        invalid('bulk resolve with an item missing its id', () =>
          api.patch(`/skill-merge-requests/${mergeRequest.id}/items`, {
            items: [{ resolution_type: 'skip' }]
          })
        ),
        notFound('resolve an item of another merge request', () =>
          api.patch(`/skill-merge-requests/${mergeRequest.id}/items/${otherItem.id}`, {
            resolution_type: 'skip'
          })
        ),
        notFound('bulk resolve an item of another merge request', () =>
          api.patch(`/skill-merge-requests/${mergeRequest.id}/items`, {
            items: [{ item_id: otherItem.id, resolution_type: 'skip' }]
          })
        )
      ]);

      let untouched = expectOk(
        await api.get(`/skill-merge-requests/${otherMergeRequest.id}/plan`)
      );
      expect(untouched.items[0].item.resolution_type).toBe(otherItem.resolution_type);
    });

    it('serves merge requests to every instance credential and hides them from other organizations', async () => {
      let { fork } = await createForkWithChanges();
      let mergeRequest = await openMergeRequest(org.clients.instance, fork.id);
      let clients = skillClients(org, otherOrg, member);
      let base = `/skill-merge-requests/${mergeRequest.id}`;

      await expectRoutesAuth(org, clients, [
        getRoute('/skill-merge-requests', listAuth),
        getRoute(base, resourceAuth),
        getRoute(`${base}/plan`, resourceAuth),
        getRoute(`${base}/events`, resourceAuth),
        getRoute(`${base}/comments`, resourceAuth),
        {
          label: 'POST /skill-merge-requests/:id/close',
          call: (client, route) => client.post(route(`${base}/close`)),
          expected: {
            none: 401,
            otherSession: 404,
            otherManagement: 404,
            otherInstance: 404
          }
        }
      ]);

      let stillOpen = expectOk(await org.clients.instance.get(base));
      expect(stillOpen.status).toBe('open');

      let viaMember = expectOk(await memberApi(org, member).get(base));
      expect(viaMember.id).toBe(mergeRequest.id);

      let closedByMember = expectOk(await memberApi(org, member).post(`${base}/close`));
      expect(closedByMember.status).toBe('closed');
    });
  });

  describe('comments', () => {
    it('creates, threads, lists, updates and deletes comments', async () => {
      let api = dashboardApi(org);
      let [firstPath, secondPath] = [uniquePath('first'), uniquePath('second')];
      let { fork } = await createForkWithChanges([firstPath, secondPath]);
      let mergeRequest = await openMergeRequest(api, fork.id);
      let plan = expectOk(await api.get(`/skill-merge-requests/${mergeRequest.id}/plan`));
      let firstItem = plan.items.find((entry: any) => entry.item.path === firstPath).item;
      let base = `/skill-merge-requests/${mergeRequest.id}/comments`;

      let general = expectOk(await api.post(base, { body: 'Looks good overall' }));
      expectPresented(general, 'skill.merge_request.comment');
      expect(general).toMatchObject({
        body: 'Looks good overall',
        path: null,
        skill_merge_request_item_id: null,
        in_reply_to_comment_id: null,
        deleted_at: null
      });

      let onItem = expectOk(
        await api.post(base, { body: 'On the item', item_id: firstItem.id })
      );
      expect(onItem).toMatchObject({
        skill_merge_request_item_id: firstItem.id,
        path: firstPath
      });

      let onPath = expectOk(await api.post(base, { body: 'On the path', path: secondPath }));
      expect(onPath.path).toBe(secondPath);

      let reply = expectOk(
        await api.post(base, { body: 'A reply', in_reply_to_comment_id: onItem.id })
      );
      expect(reply).toMatchObject({
        in_reply_to_comment_id: onItem.id,
        skill_merge_request_item_id: firstItem.id
      });

      expect(ids(await listAll(api, base))).toEqual([
        general.id,
        onItem.id,
        onPath.id,
        reply.id
      ]);
      expect(ids(await listAll(api, base, { query: { item_id: firstItem.id } }))).toEqual([
        onItem.id,
        reply.id
      ]);

      let fetched = expectOk(await api.get(`${base}/${general.id}`));
      expect(fetched).toMatchObject({ id: general.id, body: 'Looks good overall' });

      let updated = expectOk(await api.patch(`${base}/${general.id}`, { body: 'Edited' }));
      expect(updated.body).toBe('Edited');

      let refreshed = expectOk(await api.get(`/skill-merge-requests/${mergeRequest.id}`));
      expect(refreshed.comment_count).toBe(4);

      let commented = await listAll(api, `/skill-merge-requests/${mergeRequest.id}/events`, {
        query: { type: 'commented' }
      });
      expect(commented.map(event => event.comment?.id)).toEqual([
        general.id,
        onItem.id,
        onPath.id,
        reply.id
      ]);

      let deleted = expectOk(await api.delete(`${base}/${general.id}`));
      expectPresented(deleted, 'skill.merge_request.comment');
      expect(deleted.deleted_at).not.toBeNull();

      expect(ids(await listAll(api, base))).not.toContain(general.id);
      expectError(await api.get(`${base}/${general.id}`), 404);
    });

    it('lets only the author or an organization member manage a comment', async () => {
      let api = dashboardApi(org);
      let { fork } = await createForkWithChanges();
      let mergeRequest = await openMergeRequest(api, fork.id);
      let base = `/skill-merge-requests/${mergeRequest.id}/comments`;
      let comment = expectOk(await api.post(base, { body: 'Original' }));

      await expectResponses([
        forbidden('update by an instance key', () =>
          org.clients.instance.patch(`${base}/${comment.id}`, { body: 'By a key' })
        ),
        forbidden('delete by an instance key', () =>
          org.clients.instance.delete(`${base}/${comment.id}`)
        ),
        notFound('update from another organization', () =>
          otherOrg.clients.instance.patch(`${base}/${comment.id}`, { body: 'x' })
        )
      ]);

      let byMember = expectOk(
        await memberApi(org, member).patch(`${base}/${comment.id}`, { body: 'By a member' })
      );
      expect(byMember.body).toBe('By a member');

      let keyComment = expectOk(await org.clients.instance.post(base, { body: 'From a key' }));
      let keyEdited = expectOk(
        await org.clients.instance.patch(`${base}/${keyComment.id}`, { body: 'Key edited' })
      );
      expect(keyEdited.body).toBe('Key edited');

      let managementComment = expectOk(
        await managementApi(org).post(base, { body: 'From a management key' })
      );
      expect(managementComment.body).toBe('From a management key');

      let deletedByMember = expectOk(
        await memberApi(org, member).delete(`${base}/${keyComment.id}`)
      );
      expect(deletedByMember.deleted_at).not.toBeNull();
    });

    it('rejects invalid comments and comments outside the merge request', async () => {
      let api = dashboardApi(org);
      let { fork } = await createForkWithChanges();
      let mergeRequest = await openMergeRequest(api, fork.id);
      let other = await createForkWithChanges();
      let otherMergeRequest = await openMergeRequest(api, other.fork.id);
      let otherPlan = expectOk(
        await api.get(`/skill-merge-requests/${otherMergeRequest.id}/plan`)
      );
      let otherComment = expectOk(
        await api.post(`/skill-merge-requests/${otherMergeRequest.id}/comments`, { body: 'x' })
      );
      let base = `/skill-merge-requests/${mergeRequest.id}/comments`;
      let comment = expectOk(await api.post(base, { body: 'Mine' }));

      await expectResponses([
        invalid('comment without a body', () => api.post(base, {})),
        invalid('comment with a numeric body', () => api.post(base, { body: 1 })),
        invalid('update without a body', () => api.patch(`${base}/${comment.id}`, {})),
        badRequest('comment with a blank body', () => api.post(base, { body: '   ' })),
        badRequest('comment on a path outside the merge request', () =>
          api.post(base, { body: 'x', path: '/not-in-the-request.md' })
        ),
        badRequest('update with a blank body', () =>
          api.patch(`${base}/${comment.id}`, { body: '  ' })
        ),
        notFound('comment on an item of another merge request', () =>
          api.post(base, { body: 'x', item_id: otherPlan.items[0].item.id })
        ),
        notFound('reply to a comment of another merge request', () =>
          api.post(base, { body: 'x', in_reply_to_comment_id: otherComment.id })
        ),
        notFound('get a comment through another merge request', () =>
          api.get(`${base}/${otherComment.id}`)
        ),
        notFound('update a comment through another merge request', () =>
          api.patch(`${base}/${otherComment.id}`, { body: 'hijacked' })
        ),
        notFound('delete a comment through another merge request', () =>
          api.delete(`${base}/${otherComment.id}`)
        )
      ]);

      expect(ids(await listAll(api, base))).toEqual([comment.id]);
      let untouched = expectOk(
        await api.get(
          `/skill-merge-requests/${otherMergeRequest.id}/comments/${otherComment.id}`
        )
      );
      expect(untouched.body).toBe('x');
    });
  });

  describe('events', () => {
    it('scopes events to their merge request and validates filters', async () => {
      let api = org.clients.instance;
      let { fork } = await createForkWithChanges();
      let mergeRequest = await openMergeRequest(api, fork.id);
      let other = await createForkWithChanges();
      let otherMergeRequest = await openMergeRequest(api, other.fork.id);
      let [otherEvent] = await listAll(
        api,
        `/skill-merge-requests/${otherMergeRequest.id}/events`
      );

      await expectResponses([
        invalid('list with an unknown type', () =>
          api.get(`/skill-merge-requests/${mergeRequest.id}/events`, {
            query: { type: 'reopened' }
          })
        ),
        notFound('get an event through another merge request', () =>
          api.get(`/skill-merge-requests/${mergeRequest.id}/events/${otherEvent.id}`)
        )
      ]);

      await expectRoutesAuth(org, skillClients(org, otherOrg, member), [
        getRoute(
          `/skill-merge-requests/${otherMergeRequest.id}/events/${otherEvent.id}`,
          resourceAuth
        )
      ]);
    });
  });

  describe('fork syncs', () => {
    it('synchronizes a fork whose upstream has not changed', async () => {
      let api = org.clients.instance;
      let fixture = await loadOrganizationFixture(org.ids);
      let upstream = await createSkill(api);
      let fork = await forkSkillInProcess(fixture, upstream.id);

      let sync = expectOk(await api.post('/skill-fork-syncs', { skill_id: fork.id }));
      expectPresented(sync, 'skill.fork_sync');
      expect(sync).toMatchObject({ fork_skill_id: fork.id, upstream_skill_id: upstream.id });

      let completed = await eventually(async () => {
        let current = expectOk(await api.get(`/skill-fork-syncs/${sync.id}`));
        expect(current.status).toBe('completed');
        return current;
      }, mergeTimeout);
      expectPresented(completed, 'skill.fork_sync');
      expect(completed).toMatchObject({ id: sync.id, merge_request_id: null, error: null });

      await expectRoutesAuth(org, skillClients(org, otherOrg, member), [
        getRoute(`/skill-fork-syncs/${sync.id}`, resourceAuth)
      ]);
    });

    it('rejects syncs for skills that are not forks or belong to another organization', async () => {
      let api = org.clients.instance;
      let upstream = await createSkill(api);
      let foreignSkill = await createSkill(otherOrg.clients.instance);

      await expectResponses([
        invalid('sync without a skill id', () => api.post('/skill-fork-syncs', {})),
        badRequest('sync a skill that is not a fork', () =>
          api.post('/skill-fork-syncs', { skill_id: upstream.id })
        ),
        notFound('sync another organization skill', () =>
          api.post('/skill-fork-syncs', { skill_id: foreignSkill.id })
        ),
        notFound('unknown fork sync', () => api.get('/skill-fork-syncs/sksync_missing'))
      ]);
    });
  });
});
