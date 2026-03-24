import { describe, it, expect, beforeEach } from 'vitest';
import { SlateInstanceOAuthSetupStatus } from '../../../../prisma/generated/client';
import { testDb, cleanDatabase } from '../../../test/setup';
import { fixtures } from '../../../test/fixtures';
import { slatesHubClient } from '../../../test/client';

describe('slateOAuthSetup:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns OAuth setups for a tenant', async () => {
    const { setup, tenant, slate, credentials, authMethod } = await f.slateOAuthSetup.complete();

    await f.slateOAuthSetup.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      authMethodOid: authMethod.oid,
      oauthCredentialsOid: credentials.oid
    });

    const result = await slatesHubClient.slateOAuthSetup.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      object: 'slate.oauth_setup',
      id: setup.id,
      slateId: slate.id,
      status: SlateInstanceOAuthSetupStatus.unused,
      redirectUrl: setup.redirectUrl,
      url: expect.any(String),
      error: null,
      credentials: {
        object: 'slate.oauth_credentials',
        id: credentials.id
      },
      authConfig: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });

  it('filters by slateIds', async () => {
    const { setup: setup1, tenant, slate: slate1 } = await f.slateOAuthSetup.complete({
      slateIdentifier: 'slate-1'
    });

    await f.slateOAuthSetup.complete({
      slateIdentifier: 'slate-2'
    });

    const result = await slatesHubClient.slateOAuthSetup.list({
      tenantId: tenant.id,
      slateIds: [slate1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(setup1.id);
  });
});

describe('slateOAuthSetup:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single OAuth setup by ID', async () => {
    const { setup, tenant, slate } = await f.slateOAuthSetup.complete({
      status: SlateInstanceOAuthSetupStatus.unused
    });

    const result = await slatesHubClient.slateOAuthSetup.get({
      tenantId: tenant.id,
      slateOAuthSetupId: setup.id
    });

    expect(result).toMatchObject({
      object: 'slate.oauth_setup',
      id: setup.id,
      slateId: slate.id,
      status: SlateInstanceOAuthSetupStatus.unused
    });
  });
});

describe('slateOAuthSetup:getLogs E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns logs for an OAuth setup', async () => {
    const { setup, slate, tenant } = await f.slateOAuthSetup.complete();

    const result = await slatesHubClient.slateOAuthSetup.getLogs({
      tenantId: tenant.id,
      slateOAuthSetupId: setup.id
    });

    expect(result).toMatchObject({
      object: 'slate.oauth_setup',
      id: setup.id,
      slateId: slate.id,
      error: null,
      events: []
    });
  });
});

describe('slateOAuthSetup:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple OAuth setups by IDs', async () => {
    const tenant = await f.tenant.default();
    const slate = await f.slate.complete();
    const authMethod = await f.slateAuthMethod.default({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid
    });
    const credsSecret = await f.secret.default({ tenantOid: tenant.oid });
    const credentials = await f.slateOAuthCredentials.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      secretOid: credsSecret.oid
    });

    const setup1 = await f.slateOAuthSetup.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      authMethodOid: authMethod.oid,
      oauthCredentialsOid: credentials.oid
    });
    const setup2 = await f.slateOAuthSetup.withSecret({
      tenantOid: tenant.oid,
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      authMethodOid: authMethod.oid,
      oauthCredentialsOid: credentials.oid
    });

    const result = await slatesHubClient.slateOAuthSetup.getMany({
      tenantId: tenant.id,
      slateOAuthSetupIds: [setup1.id, setup2.id]
    });

    expect(result).toMatchObject([{ id: setup1.id }, { id: setup2.id }]);
  });
});
