import { expectOk, metorialEndpoints, rest, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { apiKeyService } from '@metorial/module-machine-access';
import { describe, expect, it } from 'vitest';

describe('api-core', () => {
  let org = useOrganization();

  it('serves /ping', async () => {
    let response = await rest(metorialEndpoints().api).get('/ping');
    expect(response.status).toBe(200);
  });

  it('rejects unauthenticated requests', async () => {
    let response = await rest(metorialEndpoints().api).get('/instance');
    expect(response.status).toBe(401);
  });

  it('serves the dashboard API to a user session', async () => {
    let organizations = expectOk(await org.clients.rest.get('/dashboard/organizations'));
    expect(organizations.items.map((item: { id: string }) => item.id)).toContain(
      org.ids.organizationId
    );

    let projects = expectOk(
      await org.clients.rest.get(`/dashboard/organizations/${org.ids.organizationId}/projects`)
    );
    expect(projects.items.map((item: { id: string }) => item.id)).toContain(org.ids.projectId);
  });

  it('serves the management API to an organization management key', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { secret } = await apiKeyService.createApiKey({
      type: 'organization_management_token',
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('mgmt') }
    });
    let management = rest(metorialEndpoints().api, { apiKey: secret.secret });

    let organization = expectOk(await management.get('/organization'));
    expect(organization.id).toBe(org.ids.organizationId);

    let projects = expectOk(await management.get('/organization/projects'));
    expect(projects.items.map((item: { id: string }) => item.id)).toContain(org.ids.projectId);
  });

  it('serves the instance API to an instance secret key', async () => {
    let instance = expectOk(await org.clients.instance.get('/instance'));
    expect(instance.id).toBe(org.ids.instanceId);

    let errors = expectOk(await org.clients.instance.get('/session-errors'));
    expect(Array.isArray(errors.items)).toBe(true);
  });
});
