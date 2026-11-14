import {
  connectSession,
  createProviderSession,
  createRemoteProvider,
  expectOk,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

describe('session connection isolation', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let createSandboxKey = async () => {
    let sandbox = expectOk(
      await org.clients.management.post('/organization/sandboxes', {
        name: uniqueId('e2e-sandbox'),
        project_id: org.ids.projectId
      })
    );
    let key = expectOk(
      await org.clients.rest.post(
        `/dashboard/organizations/${org.ids.organizationId}/api-keys`,
        {
          type: 'instance_access_token_secret',
          instance_id: sandbox.instance.id,
          name: uniqueId('e2e-sandbox-key')
        }
      )
    );
    return key.secret as string;
  };

  it('only lets keys of the session instance connect to it', async () => {
    let { providerId } = await createRemoteProvider(org.clients.instance, { url: server.url });
    let session = await createProviderSession(org.clients.instance, [providerId]);

    let own = await connectSession(session.id, org.keys.instanceSecret).initialize();
    expect(own.status).toBe(200);
    expect(own.result.capabilities).toHaveProperty('tools');

    let sameProject = await connectSession(session.id, await createSandboxKey()).initialize();
    expect(sameProject.status).toBe(404);
    expect(sameProject.result).toBeUndefined();

    let otherTenant = await connectSession(
      session.id,
      otherOrg.keys.instanceSecret
    ).initialize();
    expect(otherTenant.status).toBe(404);
    expect(otherTenant.result).toBeUndefined();
  }, 120_000);
});
