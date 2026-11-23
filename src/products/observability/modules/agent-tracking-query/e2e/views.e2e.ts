import {
  eventuallyAudited,
  expectOk,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization,
  type BootstrappedOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { Instance } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import {
  agentTrackingViewService,
  maxViewsPerPage,
  type TeamViewKind,
  type TeamViewParams
} from '../src';

let practicesParams: TeamViewParams = {
  version: 1,
  range: 'last_30_days',
  sort: 'high_effort_share',
  order: 'desc',
  high_effort_share_min: 0.5,
  flagged_only: true
};

let createView = async (
  fixture: OrganizationFixture,
  input: { name?: string; kind?: TeamViewKind; params?: TeamViewParams } = {}
) =>
  await agentTrackingViewService.createView({
    organization: fixture.organization,
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      page: 'team',
      name: input.name ?? uniqueId('View'),
      kind: input.kind ?? 'practices',
      params: input.params ?? practicesParams
    }
  });

let listedIds = async (fixture: { instance: Instance }) =>
  (
    await firstPage(
      await agentTrackingViewService.listViews({ instance: fixture.instance, pages: ['team'] })
    )
  ).map(view => view.id);

let siblingInstance = async (org: BootstrappedOrganization) => {
  let project = expectOk(
    await org.clients.rest.post(
      `/dashboard/organizations/${org.ids.organizationId}/projects`,
      {
        name: uniqueId('E2E Views Project')
      }
    )
  );
  let instances = expectOk(
    await org.clients.rest.get(
      `/dashboard/organizations/${org.ids.organizationId}/instances`,
      {
        query: { project_id: project.id }
      }
    )
  );

  return await db.instance.findUniqueOrThrow({ where: { id: instances.items[0].id } });
};

describe('module-agent-tracking-query saved views', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates, reads, lists, updates and deletes a view', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('High effort');

    let created = await createView(fixture, { name: `  ${name}  ` });
    expect(created.id.startsWith('atvw_')).toBe(true);
    expect(created.creatorActor?.id).toBe(fixture.actor.id);

    let row = await db.agentTrackingView.findUniqueOrThrow({
      where: { id: created.id },
      include: { instance: true }
    });
    expect(row).toMatchObject({
      status: 'active',
      page: 'team',
      kind: 'practices',
      name,
      nameKey: name.toLowerCase(),
      params: practicesParams,
      deletedAt: null
    });
    expect(row.instance.id).toBe(org.ids.instanceId);

    let fetched = await agentTrackingViewService.getViewById({
      instance: fixture.instance,
      viewId: created.id
    });
    expect(fetched.name).toBe(name);
    expect(await listedIds(fixture)).toContain(created.id);

    let renamed = uniqueId('Renamed');
    let updated = await agentTrackingViewService.updateView({
      view: fetched,
      auditScope: fixture.auditScope,
      input: { name: renamed, kind: 'leaderboard', params: { version: 1, sort: 'cost' } }
    });
    expect(updated).toMatchObject({
      name: renamed,
      kind: 'leaderboard',
      params: { version: 1, sort: 'cost' }
    });

    let paramsOnly = await agentTrackingViewService.updateView({
      view: updated,
      auditScope: fixture.auditScope,
      input: { params: { version: 1, range: 'today' } }
    });
    expect(paramsOnly).toMatchObject({
      name: renamed,
      kind: 'leaderboard',
      params: { version: 1, range: 'today' }
    });

    let deleted = await agentTrackingViewService.deleteView({
      view: paramsOnly,
      auditScope: fixture.auditScope
    });
    expect(deleted).toMatchObject({ status: 'deleted', nameKey: null });
    expect(deleted.deletedAt).toBeInstanceOf(Date);

    await expectServiceError(
      agentTrackingViewService.getViewById({ instance: fixture.instance, viewId: created.id }),
      'not_found'
    );
    expect(await listedIds(fixture)).not.toContain(created.id);
    await expectServiceError(
      agentTrackingViewService.deleteView({ view: deleted, auditScope: fixture.auditScope }),
      'not_found'
    );
    await expectServiceError(
      agentTrackingViewService.updateView({
        view: paramsOnly,
        auditScope: fixture.auditScope,
        input: { name: uniqueId('Late') }
      }),
      'not_found'
    );
  });

  it('refuses invalid names and by_model views without models, without writing', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let before = await db.agentTrackingView.count({
      where: { instanceOid: fixture.instance.oid }
    });

    let invalid: { name?: string; kind?: TeamViewKind; params?: TeamViewParams }[] = [
      { name: '   ' },
      { name: 'x'.repeat(81) },
      { name: 'Zero\u200bwidth' },
      { kind: 'by_model', params: { version: 1 } },
      { kind: 'by_model', params: { version: 1, model_ids: [] } }
    ];
    for (let input of invalid) {
      await expectServiceError(createView(fixture, input), 'invalid_data');
    }

    let view = await createView(fixture, {
      kind: 'seats',
      params: { version: 1, sort: 'seat_usage' }
    });
    await expectServiceError(
      agentTrackingViewService.updateView({
        view,
        auditScope: fixture.auditScope,
        input: { kind: 'by_model' }
      }),
      'invalid_data'
    );

    expect(
      await db.agentTrackingView.count({ where: { instanceOid: fixture.instance.oid } })
    ).toBe(before + 1);
  });

  it('keeps names unique per instance and page without regard to case', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Shared Name');

    let first = await createView(fixture, { name });
    await expectServiceError(createView(fixture, { name: name.toUpperCase() }), 'conflict');
    await expectServiceError(
      createView(fixture, { name: ` ${name.toLowerCase()} ` }),
      'conflict'
    );

    let second = await createView(fixture);
    await expectServiceError(
      agentTrackingViewService.updateView({
        view: second,
        auditScope: fixture.auditScope,
        input: { name: name.toLowerCase() }
      }),
      'conflict'
    );

    let recased = await agentTrackingViewService.updateView({
      view: first,
      auditScope: fixture.auditScope,
      input: { name: name.toUpperCase() }
    });
    expect(recased.name).toBe(name.toUpperCase());

    await agentTrackingViewService.deleteView({
      view: recased,
      auditScope: fixture.auditScope
    });
    let reused = await createView(fixture, { name });
    expect(reused.id).not.toBe(first.id);
    expect(await listedIds(fixture)).toContain(reused.id);
  });

  it('keeps views to their instance and organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let sibling = await siblingInstance(org);
    let name = uniqueId('Isolated');

    let view = await createView(fixture, { name });

    for (let instance of [other.instance, sibling]) {
      await expectServiceError(
        agentTrackingViewService.getViewById({ instance, viewId: view.id }),
        'not_found'
      );
      expect(await listedIds({ instance })).not.toContain(view.id);
    }

    let siblingView = await agentTrackingViewService.createView({
      organization: fixture.organization,
      project: await db.project.findUniqueOrThrow({ where: { oid: sibling.projectOid } }),
      instance: sibling,
      auditScope: fixture.auditScope,
      input: { page: 'team', name, kind: 'recent', params: { version: 1 } }
    });
    expect(await listedIds({ instance: sibling })).toEqual([siblingView.id]);
    expect(await listedIds(fixture)).not.toContain(siblingView.id);
  });

  it('audits creation, update and deletion', async () => {
    let fixture = await loadOrganizationFixture(otherOrg.ids);

    let view = await createView(fixture);
    let updated = await agentTrackingViewService.updateView({
      view,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Audited') }
    });
    await agentTrackingViewService.deleteView({
      view: updated,
      auditScope: fixture.auditScope
    });

    await eventuallyAudited(async () => {
      let logs = await db.auditLog.findMany({
        where: { organizationOid: fixture.organization.oid, resource: 'agent_tracking_view' }
      });
      expect([...new Set(logs.map(log => log.action))].sort()).toEqual([
        'create',
        'delete',
        'update'
      ]);
      expect(logs.every(log => log.actorId == fixture.actor.id)).toBe(true);
      expect(logs.filter(log => log.action == 'update')).toHaveLength(1);
    });
  }, 180_000);
});

describe('module-agent-tracking-query saved view limit', () => {
  let org = useOrganization();

  it(`allows ${maxViewsPerPage} live views per page`, async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let views = [];
    for (let index = 0; index < maxViewsPerPage; index++) {
      views.push(await createView(fixture, { kind: 'recent', params: { version: 1 } }));
    }

    let refused = await expectServiceError(createView(fixture), 'view_limit_exceeded');
    expect(refused.status).toBe(400);

    await agentTrackingViewService.deleteView({
      view: views[0]!,
      auditScope: fixture.auditScope
    });
    expect((await createView(fixture)).status).toBe('active');
    await expectServiceError(createView(fixture), 'view_limit_exceeded');
  }, 120_000);
});
