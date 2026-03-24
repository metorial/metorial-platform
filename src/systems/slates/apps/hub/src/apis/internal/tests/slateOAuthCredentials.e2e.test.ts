import { beforeEach, describe, expect, it } from 'vitest';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateOAuthCredentials:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns OAuth credentials for a tenant', async () => {
    const { credentials, tenant, slate } = await f.slateOAuthCredentials.complete();

    await f.slateOAuthCredentials.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid
    });

    const result = await slatesHubClient.slateOAuthCredentials.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      object: 'slate.oauth_credentials',
      id: credentials.id,
      slateId: slate.id,
      clientId: credentials.clientId,
      scopes: credentials.scopes,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });

  it('filters by slateIds', async () => {
    const {
      credentials: creds1,
      tenant,
      slate: slate1
    } = await f.slateOAuthCredentials.complete({ slateIdentifier: 'slate-1' });

    const slate2 = await f.slate.complete({ slateIdentifier: 'slate-2' });
    const secret2 = await f.secret.default({ tenantOid: tenant.oid });
    await f.slateOAuthCredentials.default({
      slateOid: slate2.oid,
      tenantOid: tenant.oid,
      secretOid: secret2.oid
    });

    const result = await slatesHubClient.slateOAuthCredentials.list({
      tenantId: tenant.id,
      slateIds: [slate1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(creds1.id);
  });
});

describe('slateOAuthCredentials:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single OAuth credentials by ID', async () => {
    const { credentials, tenant, slate } = await f.slateOAuthCredentials.complete();

    const result = await slatesHubClient.slateOAuthCredentials.get({
      tenantId: tenant.id,
      slateOAuthCredentialsId: credentials.id
    });

    expect(result).toMatchObject({
      id: credentials.id,
      slateId: slate.id,
      clientId: credentials.clientId
    });
  });
});

describe('slateOAuthCredentials:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple OAuth credentials by IDs', async () => {
    const tenant = await f.tenant.default();
    const slate = await f.slate.complete();

    const creds1 = await f.slateOAuthCredentials.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid
    });
    const creds2 = await f.slateOAuthCredentials.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid
    });

    const result = await slatesHubClient.slateOAuthCredentials.getMany({
      tenantId: tenant.id,
      slateOAuthCredentialsIds: [creds1.id, creds2.id]
    });

    expect(result).toMatchObject([{ id: creds1.id }, { id: creds2.id }]);
  });
});
