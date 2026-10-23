import {
  createRemoteProvider,
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import {
  createProviderDeployment,
  crossTenantClients,
  expectResponses,
  expectRoutesAuth,
  ids,
  invalid,
  listAuth,
  managementApi,
  notFound,
  resourceAuth,
  workerTimeout
} from './_shared';

let networkListAuth = { ...listAuth, instance: 403 };
let networkResourceAuth = { ...resourceAuth, instance: 403 };

describe('api-core integrations: integration networking', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let createFirewall = async (target = org) =>
    expectOk(
      await managementApi(target).post('/firewalls', { name: uniqueId('e2e-firewall') })
    );

  let assignGateway = async (firewallId: string) =>
    expectOk(
      await managementApi(org).post('/integration-firewall-assignments', {
        firewall_id: firewallId,
        target_type: 'internet_gateway'
      })
    );

  it('authenticates every integration networking route per credential', async () => {
    let assignment = await assignGateway((await createFirewall()).id);

    await expectRoutesAuth(org, otherOrg, [
      { path: '/integration-enclaves', expected: networkListAuth },
      { path: '/integration-firewall-assignments', expected: networkListAuth },
      { path: '/integration-internet-gateway', expected: networkListAuth },
      {
        path: `/integration-firewall-assignments/${assignment.id}`,
        expected: networkResourceAuth
      }
    ]);

    let lastUsed = `/dashboard/instances/${org.ids.instanceId}/integration-enclaves/last-used`;
    await expectAuthMatrix(crossTenantClients(org, otherOrg), client => client.get(lastUsed), {
      none: 401,
      session: 200,
      management: 403,
      otherSession: 404
    });
  });

  it('rejects invalid integration networking bodies and queries', async () => {
    let management = managementApi(org);
    let firewall = await createFirewall();

    await expectResponses([
      invalid('assignment without firewall', () =>
        management.post('/integration-firewall-assignments', {
          target_type: 'internet_gateway'
        })
      ),
      invalid('assignment with unknown target type', () =>
        management.post('/integration-firewall-assignments', {
          firewall_id: firewall.id,
          target_type: 'machine'
        })
      ),
      invalid('assignment list with unknown target type', () =>
        management.get('/integration-firewall-assignments', {
          query: { target_type: 'machine' }
        })
      ),
      invalid('network logs without direction', () =>
        management.get('/integration-internet-gateway/network-logs')
      ),
      invalid('network logs with unknown direction', () =>
        management.get('/integration-internet-gateway/network-logs', {
          query: { direction: 'sideways' }
        })
      )
    ]);

    let mismatched = (label: string, body: Record<string, unknown>) => ({
      label,
      call: () =>
        management.post('/integration-firewall-assignments', {
          firewall_id: firewall.id,
          ...body
        }),
      status: 400,
      code: 'invalid_firewall_assignments'
    });

    await expectResponses([
      mismatched('gateway assignment with a provider id', {
        target_type: 'internet_gateway',
        provider_id: uniqueId('pro')
      }),
      mismatched('provider assignment without a provider id', { target_type: 'provider' }),
      mismatched('enclave assignment without an enclave id', { target_type: 'enclave' }),
      mismatched('enclave assignment with a provider id', {
        target_type: 'enclave',
        enclave_id: uniqueId('enc'),
        provider_id: uniqueId('pro')
      })
    ]);
  });

  it('returns the internet gateway of the instance', async () => {
    let gateway = expectOk(await managementApi(org).get('/integration-internet-gateway'));
    expectPresented(gateway, 'integration.internet_gateway');
    expect(gateway.public_ips.length).toBeGreaterThan(0);
    for (let publicIp of gateway.public_ips) {
      expect(publicIp).toMatchObject({
        object: 'integration.internet_gateway.public_ip',
        ip: expect.any(String),
        region: expect.any(String)
      });
    }

    let again = expectOk(
      await org.clients.rest.get(
        `/dashboard/instances/${org.ids.instanceId}/integration-internet-gateway`
      )
    );
    expect(again.id).toBe(gateway.id);

    let other = expectOk(await managementApi(otherOrg).get('/integration-internet-gateway'));
    expect(other.id).not.toBe(gateway.id);
  });

  it('lists no enclaves for a new organization', async () => {
    let management = managementApi(org);

    expect(await listAll(management, '/integration-enclaves')).toEqual([]);
    expect(
      expectOk(
        await org.clients.rest.get(
          `/dashboard/instances/${org.ids.instanceId}/integration-enclaves/last-used`,
          { query: { limit: 5 } }
        )
      ).items
    ).toEqual([]);
    expectError(await management.get(`/integration-enclaves/${uniqueId('enc')}`), 404);
  });

  it('assigns firewalls to the internet gateway and deletes the assignment', async () => {
    let management = managementApi(org);
    let firewall = await createFirewall();
    let gateway = expectOk(await management.get('/integration-internet-gateway'));

    let assignment = await assignGateway(firewall.id);
    expectPresented(assignment, 'integration.firewall_assignment');
    expect(assignment).toMatchObject({
      target_type: 'internet_gateway',
      firewall: { object: 'networking.firewall#preview', id: firewall.id, name: firewall.name }
    });

    let duplicate = await assignGateway(firewall.id);
    expect(duplicate.id).toBe(assignment.id);

    expect(
      expectOk(await management.get(`/integration-firewall-assignments/${assignment.id}`)).id
    ).toBe(assignment.id);
    for (let query of [
      { firewall_id: firewall.id },
      { firewall_id: firewall.id, target_type: 'internet_gateway' },
      { id: assignment.id, internet_gateway_id: gateway.id }
    ]) {
      expect(
        ids(await listAll(management, '/integration-firewall-assignments', { query }))
      ).toEqual([assignment.id]);
    }
    expect(
      await listAll(management, '/integration-firewall-assignments', {
        query: { firewall_id: firewall.id, target_type: 'provider' }
      })
    ).toEqual([]);

    let deleted = expectOk(
      await management.delete(`/integration-firewall-assignments/${assignment.id}`)
    );
    expectPresented(deleted, 'integration.firewall_assignment');
    expect(deleted.id).toBe(assignment.id);

    await expectResponses([
      notFound('read deleted assignment', () =>
        management.get(`/integration-firewall-assignments/${assignment.id}`)
      ),
      notFound('delete deleted assignment', () =>
        management.delete(`/integration-firewall-assignments/${assignment.id}`)
      )
    ]);
    expect(
      await listAll(management, '/integration-firewall-assignments', {
        query: { firewall_id: firewall.id }
      })
    ).toEqual([]);
  });

  it('assigns firewalls to providers the tenant uses', async () => {
    let management = managementApi(org);
    let firewall = await createFirewall();
    let provider = await createRemoteProvider(org.clients.instance, { url: server.url });
    let otherProvider = await createRemoteProvider(otherOrg.clients.instance, {
      url: server.url
    });
    await createProviderDeployment(org.clients.instance, provider.providerId);
    await createProviderDeployment(otherOrg.clients.instance, otherProvider.providerId);

    let assignment = await eventually(
      async () =>
        expectOk(
          await management.post('/integration-firewall-assignments', {
            firewall_id: firewall.id,
            target_type: 'provider',
            provider_id: provider.providerId
          })
        ),
      workerTimeout
    );
    expectPresented(assignment, 'integration.firewall_assignment');
    expect(assignment).toMatchObject({
      target_type: 'provider',
      firewall: { id: firewall.id },
      target: { id: provider.providerId }
    });
    expect(
      ids(
        await listAll(management, '/integration-firewall-assignments', {
          query: { provider_id: provider.providerId }
        })
      )
    ).toEqual([assignment.id]);

    await expectResponses([
      notFound('foreign provider', () =>
        management.post('/integration-firewall-assignments', {
          firewall_id: firewall.id,
          target_type: 'provider',
          provider_id: otherProvider.providerId
        })
      ),
      notFound('unknown enclave', () =>
        management.post('/integration-firewall-assignments', {
          firewall_id: firewall.id,
          target_type: 'enclave',
          enclave_id: uniqueId('enc')
        })
      )
    ]);
  }, 180_000);

  it('rejects assignments for foreign and archived firewalls', async () => {
    let management = managementApi(org);
    let otherFirewall = await createFirewall(otherOrg);
    let archived = await createFirewall();
    expectOk(await management.delete(`/firewalls/${archived.id}`));

    let otherAssignment = expectOk(
      await managementApi(otherOrg).post('/integration-firewall-assignments', {
        firewall_id: otherFirewall.id,
        target_type: 'internet_gateway'
      })
    );

    await expectResponses([
      notFound('foreign firewall', () =>
        management.post('/integration-firewall-assignments', {
          firewall_id: otherFirewall.id,
          target_type: 'internet_gateway'
        })
      ),
      notFound('unknown firewall', () =>
        management.post('/integration-firewall-assignments', {
          firewall_id: uniqueId('fw'),
          target_type: 'internet_gateway'
        })
      ),
      {
        label: 'archived firewall',
        call: () =>
          management.post('/integration-firewall-assignments', {
            firewall_id: archived.id,
            target_type: 'internet_gateway'
          }),
        status: 400,
        code: 'use_after_delete'
      },
      notFound('read foreign assignment', () =>
        management.get(`/integration-firewall-assignments/${otherAssignment.id}`)
      ),
      notFound('delete foreign assignment', () =>
        management.delete(`/integration-firewall-assignments/${otherAssignment.id}`)
      )
    ]);

    expect(
      expectOk(
        await managementApi(otherOrg).get(
          `/integration-firewall-assignments/${otherAssignment.id}`
        )
      ).id
    ).toBe(otherAssignment.id);
  });
});
