import {
  eventually,
  expectOk,
  metorialEndpoints,
  rest,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { createConsumer, createConsumerProfile, createPortal } from '../consumer/_shared';

describe('api-core security: authorization boundaries', () => {
  let org = useOrganization();
  let member = useMember(org, { role: 'member' });

  it('does not widen a member to admin scopes through the consumer profile header', async () => {
    let portal = await createPortal(org);
    let profile = await createConsumerProfile(org, portal.id);

    let createPortalAs = (headers: Record<string, string>) =>
      member.clients.rest.post(
        `/dashboard/instances/${org.ids.instanceId}/portals`,
        { name: uniqueId('E2E Escalation Portal') },
        { headers }
      );

    let plain = await createPortalAs({});
    expect(plain.status).toBe(403);

    let withProfile = await createPortalAs({ 'metorial-consumer-profile-id': profile.id });
    expect(withProfile.status).toBe(403);
  });

  it('never puts link invite keys into audit logs', async () => {
    let invite = expectOk(
      await org.clients.management.post('/organization/invites', {
        type: 'link',
        role: 'admin'
      })
    );
    expect(invite.invite_link.key).toBeTruthy();

    let logs = await eventually(async () => {
      let body = expectOk(
        await org.clients.management.get('/organization/audit-logs', { query: { limit: 100 } })
      );
      if (!JSON.stringify(body).includes(invite.id)) throw new Error('invite not audited yet');
      return body;
    });

    expect(JSON.stringify(logs)).not.toContain(invite.invite_link.key);
  });

  it('confines instance keys to their own project and instance on organization routes', async () => {
    let otherProject = expectOk(
      await org.clients.rest.post(
        `/dashboard/organizations/${org.ids.organizationId}/projects`,
        {
          name: uniqueId('E2E Other Project')
        }
      )
    );
    let otherInstances = expectOk(
      await org.clients.rest.get(
        `/dashboard/organizations/${org.ids.organizationId}/instances`,
        {
          query: { project_id: otherProject.id }
        }
      )
    );
    let otherInstanceId = otherInstances.items[0].id;

    let instanceKey = rest(metorialEndpoints().api, { apiKey: org.keys.instanceSecret });

    let instances = expectOk(await instanceKey.get('/organization/instances'));
    expect(instances.items.map((item: any) => item.id)).toEqual([org.ids.instanceId]);

    let projects = expectOk(await instanceKey.get('/organization/projects'));
    expect(projects.items.map((item: any) => item.id)).toEqual([org.ids.projectId]);

    expect((await instanceKey.get(`/organization/instances/${otherInstanceId}`)).status).toBe(
      403
    );
    expect(
      (await instanceKey.get(`/organization/projects/${otherProject.id}/branding`)).status
    ).toBe(403);
    expectOk(await instanceKey.get(`/organization/projects/${org.ids.projectId}/branding`));
  });

  it('keeps publishable keys and consumer tokens out of instance-wide session data', async () => {
    let portal = await createPortal(org);
    let consumer = await createConsumer(org, portal.id);

    let secret = rest(metorialEndpoints().api, { apiKey: org.keys.instanceSecret });
    let publishable = rest(metorialEndpoints().api, { apiKey: consumer.publishableKey });

    for (let path of ['/tool-calls', '/sessions', '/integration-instances']) {
      expectOk(await secret.get(path));

      let publishableOnly = await publishable.get(path);
      expect(publishableOnly.status, `publishable key on ${path}`).toBe(401);

      let withConsumer = await consumer.magnetar.get(path);
      expect(withConsumer.status, `consumer token on ${path}`).toBe(401);
    }
  });
});
