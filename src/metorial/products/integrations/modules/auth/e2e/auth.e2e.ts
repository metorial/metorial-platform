import { firstPage, testContext, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  providerAuthConfigService,
  providerAuthCredentialsService,
  providerSetupSessionService,
  providerSetupSessionUiService
} from '../src';

describe('module-auth', () => {
  let org = useOrganization();

  it('creates a provider-less setup session and resolves it by client secret', async () => {
    let { instance, actor, auditScope } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('setup-session');

    let session = await providerSetupSessionService.createProviderSetupSession({
      instance,
      organizationActor: actor,
      auditScope,
      import: testContext(),
      input: { name, type: 'auto', uiMode: 'metorial_elements' }
    });
    expect(session.name).toBe(name);
    expect(session.status).toBe('pending');
    expect(session.providerOid).toBeNull();

    let fetched = await providerSetupSessionService.getProviderSetupSessionById({
      instance,
      providerSetupSessionId: session.id
    });
    expect(fetched.id).toBe(session.id);

    let byClientSecret =
      await providerSetupSessionUiService.getProviderSetupSessionByClientSecret({
        sessionId: session.id,
        clientSecret: session.clientSecret
      });
    expect(byClientSecret.id).toBe(session.id);

    await expect(
      providerSetupSessionUiService.getProviderSetupSessionByClientSecret({
        sessionId: session.id,
        clientSecret: 'wrong-secret'
      })
    ).rejects.toThrow(/could not be found/);

    let events = await providerSetupSessionService.listProviderSetupSessionEvents({
      providerSetupSession: session
    });
    expect(events.map(event => event.type)).toContain('created');

    let sessions = await firstPage(
      await providerSetupSessionService.listProviderSetupSessions({ instance })
    );
    expect(sessions.map(item => item.id)).toContain(session.id);
  });

  it('lists no auth configs or credentials for a fresh instance', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    expect(
      await firstPage(await providerAuthConfigService.listProviderAuthConfigs({ instance }))
    ).toEqual([]);
    expect(
      await firstPage(
        await providerAuthCredentialsService.listProviderAuthCredentials({
          instance,
          origin: ['tenant_created']
        })
      )
    ).toEqual([]);

    await expect(
      providerAuthConfigService.getProviderAuthConfigById({
        instance,
        providerAuthConfigId: uniqueId('missing-auth-config')
      })
    ).rejects.toThrow(/could not be found/);
    await expect(
      providerAuthCredentialsService.getProviderAuthCredentialsById({
        instance,
        providerAuthCredentialsId: uniqueId('missing-credentials')
      })
    ).rejects.toThrow(/could not be found/);
  });
});
