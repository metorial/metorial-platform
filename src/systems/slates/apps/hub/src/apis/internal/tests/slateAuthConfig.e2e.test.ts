import { beforeEach, describe, expect, it } from 'vitest';
import { SlateAuthConfigType } from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateAuthConfig:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns auth configs for a tenant', async () => {
    const { config, authMethod, tenant, slate } = await f.slateAuthConfig.complete();

    await f.slateAuthConfig.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid,
      authMethodOid: authMethod.oid
    });

    const result = await slatesHubClient.slateAuthConfig.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: config.id,
      slateId: slate.id,
      status: 'active',
      error: null,
      profile: null,
      authMethod: {
        id: authMethod.id
      },
      oauthCredentials: null,
      tokenExpiresAt: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });

  it('filters by slateIds', async () => {
    const {
      config: config1,
      tenant,
      slate: slate1
    } = await f.slateAuthConfig.complete({
      slateIdentifier: 'slate-1'
    });

    const { authMethod: authMethod2, slate: slate2 } = await f.slateAuthMethod.withSlate({
      slateIdentifier: 'slate-2'
    });
    const secret2 = await f.secret.default({ tenantOid: tenant.oid });
    await f.slateAuthConfig.default({
      slateOid: slate2.oid,
      tenantOid: tenant.oid,
      authMethodOid: authMethod2.oid,
      secretOid: secret2.oid
    });

    const result = await slatesHubClient.slateAuthConfig.list({
      tenantId: tenant.id,
      slateIds: [slate1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(config1.id);
  });
});

describe('slateAuthConfig:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single auth config by ID', async () => {
    const { config, tenant, slate } = await f.slateAuthConfig.complete({
      type: SlateAuthConfigType.manual
    });

    const result = await slatesHubClient.slateAuthConfig.get({
      tenantId: tenant.id,
      slateAuthConfigId: config.id
    });

    expect(result).toMatchObject({
      id: config.id,
      slateId: slate.id
    });
  });
});

describe('slateAuthConfig:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple auth configs by IDs', async () => {
    const tenant = await f.tenant.default();
    const { authMethod, slate } = await f.slateAuthMethod.withSlate();

    const config1 = await f.slateAuthConfig.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid,
      authMethodOid: authMethod.oid
    });
    const config2 = await f.slateAuthConfig.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid,
      authMethodOid: authMethod.oid
    });

    const result = await slatesHubClient.slateAuthConfig.getMany({
      tenantId: tenant.id,
      slateAuthConfigIds: [config1.id, config2.id]
    });

    expect(result).toMatchObject([{ id: config1.id }, { id: config2.id }]);
  });
});
