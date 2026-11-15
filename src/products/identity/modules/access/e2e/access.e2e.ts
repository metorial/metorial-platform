import { testContext, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { apiKeyService } from '@metorial/module-machine-access';
import { describe, expect, it } from 'vitest';
import {
  accessService,
  authenticationService,
  instanceSecretTokenScopes,
  orgManagementTokenScopes,
  sessionClientSecretReferenceService
} from '../src';

describe('module-access', () => {
  let org = useOrganization();

  it('authenticates a user session and resolves its organization and instance', async () => {
    let authInfo = await authenticationService.authenticate({
      type: 'user_session',
      sessionClientSecret: org.session,
      context: testContext()
    });
    expect(authInfo.type).toBe('user');
    if (authInfo.type != 'user') return;
    expect(authInfo.user.id).toBe(org.ids.userId);

    let organization = await accessService.accessOrganization({
      authInfo,
      organizationId: org.ids.organizationId
    });
    expect(organization.organization.id).toBe(org.ids.organizationId);

    let instance = await accessService.accessInstance({
      authInfo,
      instanceId: org.ids.instanceId
    });
    expect(instance.instance.id).toBe(org.ids.instanceId);
    expect(instance.project.id).toBe(org.ids.projectId);
    expect(instance.resourceActor?.identifier).toBe(`mte-oac-${instance.actor?.id}`);
  });

  it('authenticates api keys with their scopes and restrictions', async () => {
    let context = testContext();
    let fixture = await loadOrganizationFixture(org.ids);
    let { secret } = await apiKeyService.createApiKey({
      type: 'organization_management_token',
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('mgmt') }
    });

    let management = await authenticationService.authenticate({
      type: 'api_key',
      apiKey: secret.secret,
      context
    });
    expect(management.type).toBe('machine');
    if (management.type != 'machine') return;
    expect(management.restrictions.type).toBe('organization');
    expect(management.orgScopes).toEqual(orgManagementTokenScopes);
    expect(
      (
        await accessService.accessOrganization({
          authInfo: management,
          organizationId: org.ids.organizationId
        })
      ).organization.id
    ).toBe(org.ids.organizationId);

    let instanceKey = await authenticationService.authenticate({
      type: 'api_key',
      apiKey: org.keys.instanceSecret,
      context
    });
    expect(instanceKey.type).toBe('machine');
    if (instanceKey.type != 'machine') return;
    expect(instanceKey.orgScopes).toEqual(instanceSecretTokenScopes);

    let access = await accessService.accessInstance({
      authInfo: instanceKey,
      instanceId: org.ids.instanceId
    });
    expect(access.type).toBe('actor');
    expect(access.instance.id).toBe(org.ids.instanceId);

    await expect(
      accessService.accessInstance({ authInfo: instanceKey, instanceId: uniqueId('ins') })
    ).rejects.toThrow();
    await expect(
      accessService.checkAccess({ authInfo: instanceKey, possibleScopes: ['user:write'] })
    ).rejects.toThrow(/permissions/);

    await expect(
      authenticationService.authenticate({
        type: 'api_key',
        apiKey: `${org.keys.instanceSecret}x`,
        context
      })
    ).rejects.toThrow();
  });

  it('issues session client secrets as fine grained keys scoped to the session', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let sessionId = uniqueId('ses');

    let created = await sessionClientSecretReferenceService.createForSession({
      instance: fixture.instance,
      sessionId
    });
    let reused = await sessionClientSecretReferenceService.createForSession({
      instance: fixture.instance,
      sessionId
    });
    expect(reused.reference.id).toBe(created.reference.id);
    expect(reused.clientSecret).toBe(created.clientSecret);

    let authInfo = await authenticationService.authenticate({
      type: 'api_key',
      apiKey: created.clientSecret,
      context: testContext()
    });
    expect(authInfo.type).toBe('fine_grained');
    if (authInfo.type != 'fine_grained') return;
    expect(authInfo.restrictions.instance.id).toBe(org.ids.instanceId);
    expect(authInfo.restrictions.accessTagGrants).toEqual([
      {
        resourceType: 'subspace.session',
        resourceId: sessionId,
        roles: ['instance.provider.session:read']
      }
    ]);

    await expect(
      accessService.accessOrganization({ authInfo, organizationId: org.ids.organizationId })
    ).rejects.toThrow();
  });
});
