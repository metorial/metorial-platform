import { beforeEach, describe, expect, it } from 'vitest';
import { SecretStatus, SecretType } from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('secret:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns secrets for a tenant', async () => {
    const secret = await f.secret.withTenant({
      type: SecretType.slate_authentication_configuration
    });

    await f.secret.default({ tenantOid: secret.tenant.oid });

    const result = await slatesHubClient.secret.list({
      tenantId: secret.tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      object: 'secret',
      id: secret.id,
      type: SecretType.slate_authentication_configuration,
      status: SecretStatus.active,
      createdAt: expect.any(Date)
    });
  });
});

describe('secret:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single secret by ID', async () => {
    const secret = await f.secret.withTenant({
      type: SecretType.slate_oauth_credentials
    });

    const result = await slatesHubClient.secret.get({
      tenantId: secret.tenant.id,
      secretId: secret.id
    });

    expect(result).toMatchObject({
      id: secret.id,
      type: SecretType.slate_oauth_credentials,
      status: SecretStatus.active
    });
  });
});
