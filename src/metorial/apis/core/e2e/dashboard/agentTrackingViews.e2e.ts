import {
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { agentTrackingPath } from '@metorial/agent-tracking-e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  adminOnly,
  adminOnlyClients,
  outsiderOf,
  refusedToNonAdmins
} from '../_agentTracking';

let viewBody = (overrides: Record<string, unknown> = {}) => ({
  page: 'team',
  name: uniqueId('View'),
  kind: 'practices',
  params: {
    version: 1,
    range: 'last_7_days',
    sort: 'fast_share',
    fast_share_min: 0.4,
    flagged_only: true
  },
  ...overrides
});

describe('api-core dashboard: agent tracking saved views', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let viewsPath = (path = '') => agentTrackingPath(org, `/views${path}`);

  let createView = async (overrides: Record<string, unknown> = {}) =>
    expectOk(await org.clients.rest.post(viewsPath(), viewBody(overrides)));

  it('lets only admins read and create views', async () => {
    let clients = adminOnlyClients(org, member, otherOrg);

    await expectAuthMatrix(clients, client => client.get(viewsPath()), adminOnly);
    await expectAuthMatrix(
      clients,
      client => client.post(viewsPath(), viewBody()),
      refusedToNonAdmins
    );
  });

  it('lets only admins read, update and delete a single view', async () => {
    let created = await createView();
    let clients = adminOnlyClients(org, member, otherOrg);

    await expectAuthMatrix(
      clients,
      client => client.get(viewsPath(`/${created.id}`)),
      adminOnly
    );
    await expectAuthMatrix(
      clients,
      client => client.patch(viewsPath(`/${created.id}`), { name: uniqueId('Renamed') }),
      refusedToNonAdmins
    );
    await expectAuthMatrix(
      clients,
      client => client.delete(viewsPath(`/${created.id}`)),
      refusedToNonAdmins
    );

    expectOk(await org.clients.rest.get(viewsPath(`/${created.id}`)));
  });

  it('validates the body and the page filter', async () => {
    for (let invalid of [
      {},
      viewBody({ page: undefined }),
      viewBody({ page: 'spend' }),
      viewBody({ name: undefined }),
      viewBody({ name: '' }),
      viewBody({ name: 'x'.repeat(81) }),
      viewBody({ kind: 'timeline' }),
      viewBody({ params: undefined }),
      viewBody({ params: {} }),
      viewBody({ params: { version: 2 } }),
      viewBody({ params: { version: 1, range: 'last_year' } }),
      viewBody({ params: { version: 1, sort: 'name' } }),
      viewBody({ params: { version: 1, model_share_min: 1.01 } }),
      viewBody({ params: { version: 1, seat_usage_max_micros: -5 } }),
      viewBody({
        params: { version: 1, model_ids: Array.from({ length: 101 }, (_, i) => `m${i}`) }
      }),
      viewBody({ params: { version: 1, seats: ['x'.repeat(201)] } }),
      viewBody({ kind: 'by_model', params: { version: 1 } }),
      viewBody({ name: 'x'.repeat(201) }),
      viewBody({ name: 'Zero\u200bwidth' })
    ]) {
      expectError(await org.clients.rest.post(viewsPath(), invalid), 400, 'invalid_data');
    }

    let created = await createView();
    for (let invalid of [
      { name: '' },
      { kind: 'timeline' },
      { kind: 'by_model' },
      { name: 'x'.repeat(81) }
    ]) {
      expectError(
        await org.clients.rest.patch(viewsPath(`/${created.id}`), invalid),
        400,
        'invalid_data'
      );
    }

    expectError(
      await org.clients.rest.get(viewsPath(), { query: { page: 'spend' } }),
      400,
      'invalid_data'
    );
  });

  it('presents a view without member data', async () => {
    let name = uniqueId('Fast tier');
    let created = expectPresented(
      await createView({ name: `  ${name}  ` }),
      'agent_tracking.view'
    );

    expect(created).toMatchObject({
      name,
      page: 'team',
      kind: 'practices',
      params: {
        version: 1,
        range: 'last_7_days',
        sort: 'fast_share',
        fast_share_min: 0.4,
        flagged_only: true
      },
      deleted_at: null
    });
    expect(created.id.startsWith('atvw_')).toBe(true);
    expect(created.created_by).toMatchObject({ object: 'organization.actor' });
    expect(typeof created.created_at).toBe('string');
    expect(typeof created.updated_at).toBe('string');

    let fetched = expectOk(await org.clients.rest.get(viewsPath(`/${created.id}`)));
    expect(fetched).toEqual(created);
  });

  it('updates only the fields it is given', async () => {
    let created = await createView();
    let name = uniqueId('Renamed');

    let renamed = expectOk(
      await org.clients.rest.patch(viewsPath(`/${created.id}`), { name })
    );
    expect(renamed).toMatchObject({ name, kind: created.kind, params: created.params });

    let replaced = expectOk(
      await org.clients.rest.patch(viewsPath(`/${created.id}`), {
        kind: 'seats',
        params: { version: 1, sort: 'seat_usage', seat_usage_max_micros: 20000000 }
      })
    );
    expect(replaced).toMatchObject({
      name,
      kind: 'seats',
      params: { version: 1, sort: 'seat_usage', seat_usage_max_micros: 20000000 }
    });
  });

  it('refuses a second view of the same name, whatever its case', async () => {
    let name = uniqueId('Duplicate');
    await createView({ name });

    expectError(
      await org.clients.rest.post(viewsPath(), viewBody({ name: name.toUpperCase() })),
      409,
      'conflict'
    );
  });

  it('deletes a view so it is no longer listed or found', async () => {
    let created = await createView();

    let deleted = expectOk(await org.clients.rest.delete(viewsPath(`/${created.id}`)));
    expect(deleted.id).toBe(created.id);
    expect(deleted.deleted_at).not.toBeNull();

    expectError(await org.clients.rest.get(viewsPath(`/${created.id}`)), 404, 'not_found');
    expectError(await org.clients.rest.delete(viewsPath(`/${created.id}`)), 404, 'not_found');
    expect((await listAll(org.clients.rest, viewsPath())).map(item => item.id)).not.toContain(
      created.id
    );

    let row = await db.agentTrackingView.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe('deleted');
  });

  it('pages through views without duplicates and filters by page', async () => {
    let first = await createView();
    let second = await createView();

    let ids = (await listAll(org.clients.rest, viewsPath(), { limit: 1 })).map(
      item => item.id
    );
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(new Set(ids).size).toBe(ids.length);

    let team = await listAll(org.clients.rest, viewsPath(), { query: { page: 'team' } });
    expect(team.map(item => item.id)).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it("hides another organization's views", async () => {
    let created = await createView();
    let foreign = expectOk(
      await otherOrg.clients.rest.post(agentTrackingPath(otherOrg, '/views'), viewBody())
    );

    expectError(await outsiderOf(otherOrg).get(viewsPath(`/${created.id}`)), 404, 'not_found');
    expectError(await org.clients.rest.get(viewsPath(`/${foreign.id}`)), 404, 'not_found');
    expectError(
      await org.clients.rest.patch(viewsPath(`/${foreign.id}`), { name: uniqueId('Stolen') }),
      404,
      'not_found'
    );
    expectError(await org.clients.rest.delete(viewsPath(`/${foreign.id}`)), 404, 'not_found');
    expect((await listAll(org.clients.rest, viewsPath())).map(item => item.id)).not.toContain(
      foreign.id
    );

    let untouched = await db.agentTrackingView.findUniqueOrThrow({
      where: { id: foreign.id }
    });
    expect(untouched).toMatchObject({ status: 'active', name: foreign.name });
  });

  it("hides another instance's views in the same organization", async () => {
    let created = await createView();
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
    let siblingPath = (path = '') => agentTrackingPath(instances.items[0].id, `/views${path}`);

    expectError(await org.clients.rest.get(siblingPath(`/${created.id}`)), 404, 'not_found');
    expect(
      (await listAll(org.clients.rest, siblingPath())).map(item => item.id)
    ).not.toContain(created.id);

    let sibling = expectOk(
      await org.clients.rest.post(siblingPath(), viewBody({ name: created.name }))
    );
    expect(sibling.id).not.toBe(created.id);
  });
});
