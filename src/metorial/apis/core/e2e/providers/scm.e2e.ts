import { expectAuthMatrix, expectError, listAll, useOrganization } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { dashboardOnlyStatuses, instanceRoute, tenantClients } from './_shared';

describe('api-core providers: source control', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let dashboardPath = (path: string) => `/dashboard/instances/${org.ids.instanceId}${path}`;

  it('serves source control repos to dashboard and management credentials only', async () => {
    let route = instanceRoute(org.ids.instanceId);
    let clients = tenantClients(org, otherOrg);

    let responses = await expectAuthMatrix(
      clients,
      (client, name) => client.get(route(name, '/scm/repos')),
      dashboardOnlyStatuses
    );
    expect(responses.session.body.items).toEqual([]);
    expect(responses.management.body.items).toEqual([]);

    await expectAuthMatrix(
      clients,
      (client, name) => client.get(route(name, '/scm/repos/scr_unknown')),
      { ...dashboardOnlyStatuses, session: 404, management: 404 }
    );
  });

  it('lists no repos for an instance without source control', async () => {
    expect(await listAll(org.clients.rest, dashboardPath('/scm/repos'), { limit: 1 })).toEqual(
      []
    );
    expect(
      await listAll(
        otherOrg.clients.rest,
        `/dashboard/instances/${otherOrg.ids.instanceId}/scm/repos`
      )
    ).toEqual([]);
  });

  it('validates source control bodies and queries', async () => {
    let client = org.clients.rest;

    expectError(
      await client.post(dashboardPath('/scm/providers'), { type: 'gitea' }),
      400,
      'invalid_data'
    );
    expectError(await client.post(dashboardPath('/scm/providers'), {}), 400, 'invalid_data');

    for (let body of [
      {},
      { installation_id: 42 },
      { installation_id: 'scc_unknown', limit: 0 },
      { installation_id: 'scc_unknown', limit: 101 }
    ]) {
      expectError(
        await client.post(dashboardPath('/scm/repos/preview'), body),
        400,
        'invalid_data'
      );
    }
    for (let body of [{}, { installation_id: 42 }]) {
      expectError(
        await client.post(dashboardPath('/scm/accounts/preview'), body),
        400,
        'invalid_data'
      );
    }
    for (let body of [
      {},
      { installation_id: 'scc_unknown' },
      { external_repo_id: '123' },
      { installation_id: 'scc_unknown', external_account_id: 'acct' },
      {
        installation_id: 'scc_unknown',
        external_account_id: 'acct',
        name: 'repo',
        is_private: 'yes'
      }
    ]) {
      expectError(await client.post(dashboardPath('/scm/repos'), body), 400, 'invalid_data');
    }
    expectError(
      await client.post(dashboardPath('/scm/installations'), { redirect_url: 42 }),
      400,
      'invalid_data'
    );
    expectError(
      await client.get(dashboardPath('/scm/repos'), { query: { limit: 0 } }),
      400,
      'invalid_data'
    );
  });
});
