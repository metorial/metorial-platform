import { firstPage, testContext, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { apiKeyService, machineAccessAuthService } from '../src';

describe('module-machine-access', () => {
  let org = useOrganization();

  it('creates, authenticates and revokes an instance secret key', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let context = testContext();
    let name = uniqueId('key');

    let { apiKey, secret } = await apiKeyService.createApiKey({
      type: 'instance_access_token_secret',
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name }
    });
    expect(apiKey.name).toBe(name);
    expect(apiKey.machineAccess.instance?.id).toBe(org.ids.instanceId);

    let keys = await firstPage(
      await apiKeyService.listApiKeys({
        filter: {
          type: 'instance_access_token',
          instance: fixture.instance,
          organization: fixture.organization
        }
      })
    );
    expect(keys.map(key => key.id)).toContain(apiKey.id);

    let auth = await machineAccessAuthService.authenticateWithMachineAccessToken({
      token: secret.secret,
      context
    });
    expect(auth.type).toBe('api_key');
    if (auth.type != 'api_key') return;
    expect(auth.secret.apiKey.id).toBe(apiKey.id);

    let revoked = await apiKeyService.revokeApiKey({ apiKey, auditScope: fixture.auditScope });
    expect(revoked.status).toBe('deleted');

    await expect(
      machineAccessAuthService.authenticateWithMachineAccessToken({
        token: secret.secret,
        context
      })
    ).rejects.toThrow(/expired or has been revoked/);
  });

  it('updates and rotates an organization management key', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let context = testContext();

    let created = await apiKeyService.createApiKey({
      type: 'organization_management_token',
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('mgmt') }
    });

    let apiKey = await apiKeyService.getApiKeyById({
      apiKeyId: created.apiKey.id,
      organization: fixture.organization
    });
    let name = uniqueId('renamed');
    let updated = await apiKeyService.updateApiKey({
      apiKey,
      auditScope: fixture.auditScope,
      input: { name, description: 'E2E' }
    });
    expect(updated.name).toBe(name);
    expect(updated.description).toBe('E2E');

    let managementKeys = await firstPage(
      await apiKeyService.listApiKeys({
        filter: { type: 'organization_management_token', organization: fixture.organization }
      })
    );
    expect(managementKeys.map(key => key.id)).toContain(apiKey.id);

    let rotated = await apiKeyService.rotateApiKey({
      apiKey: updated,
      auditScope: fixture.auditScope,
      input: {}
    });
    expect(rotated.secret.secret).not.toBe(created.secret.secret);

    let auth = await machineAccessAuthService.authenticateWithMachineAccessToken({
      token: rotated.secret.secret,
      context
    });
    expect(auth.type).toBe('api_key');

    await expect(
      machineAccessAuthService.authenticateWithMachineAccessToken({
        token: created.secret.secret,
        context
      })
    ).rejects.toThrow();
  });
});
