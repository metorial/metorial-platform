import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { addMinutes } from 'date-fns';
import { beforeAll, describe, expect, it } from 'vitest';
import { providerOAuthSetupInternalService, providerOAuthSetupService } from '../src';
import {
  type AuthProvider,
  type AuthScope,
  createAuthProvider,
  loadAuthScope,
  type SeededAuthMethod,
  seedAuthMethod,
  seedCredentials,
  seedOAuthSetup
} from './fixtures';

describe('module-auth provider OAuth setups', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let scope: AuthScope;
  let provider: AuthProvider;
  let tokenMethod: SeededAuthMethod;
  let oauthMethod: SeededAuthMethod;

  beforeAll(async () => {
    scope = await loadAuthScope(org);
    provider = await createAuthProvider(org, server.url);

    tokenMethod = await seedAuthMethod(scope, provider, { type: 'token', isDefault: true });
    oauthMethod = await seedAuthMethod(scope, provider, { type: 'oauth', isDefault: false });
  });

  let seedSetup = async (
    input: { expiresAt?: Date; name?: string; isEphemeral?: boolean } = {}
  ) =>
    await seedOAuthSetup(scope, provider, {
      authMethod: oauthMethod,
      credentials: await seedCredentials(scope, provider),
      ...input
    });

  let getSetup = (providerOAuthSetupId: string, instance = scope.instance) =>
    providerOAuthSetupService.getProviderOAuthSetupById({ instance, providerOAuthSetupId });

  let listSetupIds = async (instance = scope.instance) =>
    (
      await firstPage(await providerOAuthSetupService.listProviderOAuthSetups({ instance }))
    ).map(item => item.id);

  it('requires OAuth credentials and an OAuth auth method before contacting the backend', async () => {
    let name = uniqueId('rejected-oauth-setup');
    let credentials = await seedCredentials(scope, provider);

    await expectServiceError(
      providerOAuthSetupService.createProviderOAuthSetup({
        instance: scope.instance,
        provider,
        input: { name, config: {} }
      }),
      'missing_auth_credentials'
    );
    await expectServiceError(
      providerOAuthSetupService.createProviderOAuthSetup({
        instance: scope.instance,
        provider,
        credentials,
        input: { name, authMethodId: tokenMethod.id, config: {} }
      }),
      'invalid_auth_method'
    );

    let rejected = await providerOAuthSetupService
      .createProviderOAuthSetup({
        instance: scope.instance,
        provider,
        credentials,
        input: { name, config: {} }
      })
      .then(
        () => null,
        error => error
      );
    expect(rejected).toBeInstanceOf(Error);

    expect(await subspaceDb.providerOAuthSetup.count({ where: { name } })).toBe(0);
  });

  it('resolves, lists and updates OAuth setups', async () => {
    let name = uniqueId('oauth-setup');
    let setup = await seedSetup({ name });
    let ephemeral = await seedSetup({ isEphemeral: true });

    let fetched = await getSetup(setup.id);
    expect(fetched).toMatchObject({ id: setup.id, name, status: 'unused' });
    expect(fetched.authMethod?.id).toBe(oauthMethod.id);
    expect(fetched.authMethod?.specification).not.toHaveProperty('value');

    let listed = await listSetupIds();
    expect(listed).toContain(setup.id);
    expect(listed).not.toContain(ephemeral.id);
    expect((await getSetup(ephemeral.id)).isEphemeral).toBe(true);

    let updated = await providerOAuthSetupService.updateProviderOAuthSetup({
      instance: scope.instance,
      providerOAuthSetup: fetched,
      input: { description: 'Updated', metadata: { team: 'b' } }
    });
    expect(updated).toMatchObject({ name, description: 'Updated', metadata: { team: 'b' } });

    expect(
      await subspaceDb.providerOAuthSetup.findUniqueOrThrow({ where: { id: setup.id } })
    ).toMatchObject({ name, description: 'Updated', clientSecret: setup.clientSecret });
  });

  it('resolves a setup by client secret only while it is unexpired', async () => {
    let setup = await seedSetup();
    let otherSetup = await seedSetup();
    let expired = await seedSetup({ expiresAt: addMinutes(new Date(), -1) });

    let resolved = await providerOAuthSetupInternalService.getProviderOAuthSetupByClientSecret(
      {
        setupId: setup.id,
        clientSecret: setup.clientSecret
      }
    );
    expect(resolved.id).toBe(setup.id);

    await expectServiceError(
      providerOAuthSetupInternalService.getProviderOAuthSetupByClientSecret({
        setupId: setup.id,
        clientSecret: uniqueId('wrong-secret')
      }),
      'not_found'
    );
    await expectServiceError(
      providerOAuthSetupInternalService.getProviderOAuthSetupByClientSecret({
        setupId: setup.id,
        clientSecret: otherSetup.clientSecret
      }),
      'not_found'
    );
    await expectServiceError(
      providerOAuthSetupInternalService.getProviderOAuthSetupByClientSecret({
        setupId: expired.id,
        clientSecret: expired.clientSecret
      }),
      'not_found'
    );
  });

  it(
    'expires unused and opened setups once they pass their expiry',
    { timeout: 180_000 },
    async () => {
      let unused = await seedSetup({ expiresAt: addMinutes(new Date(), -1) });
      let opened = await seedSetup({ expiresAt: addMinutes(new Date(), -1) });
      let completed = await seedSetup({ expiresAt: addMinutes(new Date(), -1) });
      let live = await seedSetup();

      await subspaceDb.providerOAuthSetup.update({
        where: { oid: opened.oid },
        data: { status: 'opened' }
      });
      await subspaceDb.providerOAuthSetup.update({
        where: { oid: completed.oid },
        data: { status: 'completed' }
      });

      await eventually(
        async () => {
          let rows = await subspaceDb.providerOAuthSetup.findMany({
            where: { oid: { in: [unused.oid, opened.oid] } }
          });
          expect(rows.map(row => row.status)).toEqual(['expired', 'expired']);
        },
        { timeoutMs: 150_000, intervalMs: 1_000 }
      );

      let others = await subspaceDb.providerOAuthSetup.findMany({
        where: { oid: { in: [completed.oid, live.oid] } },
        orderBy: { oid: 'asc' }
      });
      expect(others.map(row => [row.id, row.status])).toEqual([
        [completed.id, 'completed'],
        [live.id, 'unused']
      ]);
    }
  );

  it("does not expose or modify another tenant's OAuth setups", async () => {
    let other = await loadAuthScope(otherOrg);
    let name = uniqueId('isolated-oauth-setup');
    let setup = await seedSetup({ name });

    await expectServiceError(getSetup(setup.id, other.instance), 'not_found');
    expect(await listSetupIds(other.instance)).not.toContain(setup.id);

    await expect(
      providerOAuthSetupService.updateProviderOAuthSetup({
        instance: other.instance,
        providerOAuthSetup: await getSetup(setup.id),
        input: { name: uniqueId('hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');

    expect(
      await subspaceDb.providerOAuthSetup.findUniqueOrThrow({ where: { id: setup.id } })
    ).toMatchObject({ name });
  });
});
