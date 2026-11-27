import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import { providerAuthCredentialsService } from '../src';
import {
  type AuthProvider,
  type AuthScope,
  createAuthProvider,
  loadAuthScope,
  type SeededAuthMethod,
  seedAuthConfig,
  seedAuthMethod,
  seedCredentials
} from './fixtures';

describe('module-auth provider auth credentials', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let scope: AuthScope;
  let provider: AuthProvider;
  let oauthMethod: SeededAuthMethod;

  beforeAll(async () => {
    scope = await loadAuthScope(org);
    provider = await createAuthProvider(org, server.url);
    oauthMethod = await seedAuthMethod(scope, provider, { type: 'oauth', isDefault: true });
  });

  let getCredentials = (providerAuthCredentialsId: string, instance = scope.instance) =>
    providerAuthCredentialsService.getProviderAuthCredentialsById({
      instance,
      providerAuthCredentialsId
    });

  let listCredentialIds = async (
    input: Omit<
      Parameters<typeof providerAuthCredentialsService.listProviderAuthCredentials>[0],
      'instance'
    >,
    instance = scope.instance
  ) =>
    (
      await firstPage(
        await providerAuthCredentialsService.listProviderAuthCredentials({
          instance,
          ...input
        })
      )
    ).map(item => item.id);

  it('rejects credentials the provider backend cannot hold without persisting or leaking secrets', async () => {
    let name = uniqueId('rejected-credentials');
    let clientSecret = uniqueId('client-secret');

    await expectServiceError(
      providerAuthCredentialsService.createProviderAuthCredentials({
        instance: scope.instance,
        provider,
        input: { name, config: { type: 'auto_registration' } }
      }),
      'auto_registration_not_supported'
    );

    let rejected = await providerAuthCredentialsService
      .createProviderAuthCredentials({
        instance: scope.instance,
        provider,
        input: {
          name,
          config: { type: 'oauth', clientId: uniqueId('client'), clientSecret, scopes: [] }
        }
      })
      .then(
        () => null,
        error => error
      );
    expect(rejected).toBeInstanceOf(Error);
    expect(JSON.stringify({ message: rejected.message, data: rejected.data })).not.toContain(
      clientSecret
    );

    expect(await subspaceDb.providerAuthCredentials.count({ where: { name } })).toBe(0);
  });

  it('resolves, lists and updates tenant credentials', async () => {
    let name = uniqueId('credentials');
    let created = await seedCredentials(scope, provider, { name });
    let ephemeral = await seedCredentials(scope, provider, { isEphemeral: true });

    let fetched = await getCredentials(created.id);
    expect(fetched).toMatchObject({
      id: created.id,
      name,
      type: 'oauth',
      status: 'active',
      origin: 'tenant_created'
    });

    expect(await listCredentialIds({ providerIds: [provider.id] })).toContain(created.id);
    expect(await listCredentialIds({ ids: [created.id], origin: ['tenant_created'] })).toEqual(
      [created.id]
    );
    expect(
      await listCredentialIds({ ids: [created.id], origin: ['managed_backing'] })
    ).toEqual([]);

    expect((await getCredentials(ephemeral.id)).isEphemeral).toBe(true);
    expect(await listCredentialIds({ ids: [ephemeral.id] })).toEqual([]);

    let updated = await providerAuthCredentialsService.updateProviderAuthCredentials({
      instance: scope.instance,
      auditScope: scope.fixture.auditScope,
      providerAuthCredentials: fetched,
      input: { name: `${name} renamed`, description: 'Updated', metadata: { team: 'b' } }
    });
    expect(updated).toMatchObject({
      name: `${name} renamed`,
      description: 'Updated',
      metadata: { team: 'b' },
      status: 'active'
    });

    expect(
      await subspaceDb.providerAuthCredentials.findUniqueOrThrow({ where: { id: created.id } })
    ).toMatchObject({ name: `${name} renamed`, description: 'Updated' });
  });

  it('archives credentials and rejects further changes', async () => {
    let created = await seedCredentials(scope, provider);

    let archived = await providerAuthCredentialsService.archiveProviderAuthCredentials({
      instance: scope.instance,
      auditScope: scope.fixture.auditScope,
      providerAuthCredentials: await getCredentials(created.id)
    });
    expect(archived).toMatchObject({ status: 'archived', isDefault: false });
    expect(archived.archivedAt).toBeInstanceOf(Date);

    let fetched = await getCredentials(created.id);
    expect(fetched.status).toBe('archived');
    expect(await listCredentialIds({ ids: [created.id] })).toEqual([]);
    expect(await listCredentialIds({ ids: [created.id], status: ['archived'] })).toEqual([
      created.id
    ]);

    await expectServiceError(
      providerAuthCredentialsService.updateProviderAuthCredentials({
        instance: scope.instance,
        providerAuthCredentials: fetched,
        input: { name: uniqueId('renamed') }
      }),
      'gone'
    );
    await expectServiceError(
      providerAuthCredentialsService.archiveProviderAuthCredentials({
        instance: scope.instance,
        providerAuthCredentials: fetched
      }),
      'gone'
    );
  });

  it('refuses to archive credentials that are not tenant created', async () => {
    let created = await seedCredentials(scope, provider);
    let managed = await subspaceDb.providerAuthCredentials.update({
      where: { oid: created.oid },
      data: { origin: 'managed_backing' }
    });

    await expectServiceError(
      providerAuthCredentialsService.archiveProviderAuthCredentials({
        instance: scope.instance,
        providerAuthCredentials: managed
      }),
      'managed_credentials_readonly'
    );

    expect(
      await subspaceDb.providerAuthCredentials.findUniqueOrThrow({
        where: { oid: created.oid }
      })
    ).toMatchObject({ status: 'active' });
  });

  it('archives the auth configs that use archived credentials', async () => {
    let credentials = await seedCredentials(scope, provider);
    let otherCredentials = await seedCredentials(scope, provider);
    let authConfig = await seedAuthConfig(scope, provider, oauthMethod, {
      type: 'oauth_manual',
      credentials
    });
    let unrelated = await seedAuthConfig(scope, provider, oauthMethod, {
      type: 'oauth_manual',
      credentials: otherCredentials
    });

    await providerAuthCredentialsService.archiveProviderAuthCredentials({
      instance: scope.instance,
      providerAuthCredentials: await getCredentials(credentials.id)
    });

    await eventually(async () => {
      let row = await subspaceDb.providerAuthConfig.findUniqueOrThrow({
        where: { oid: authConfig.oid }
      });
      expect(row.status).toBe('archived');
    });

    expect(
      await subspaceDb.providerAuthConfig.findUniqueOrThrow({ where: { oid: unrelated.oid } })
    ).toMatchObject({ status: 'active' });
  });

  it("does not expose or modify another tenant's credentials", async () => {
    let other = await loadAuthScope(otherOrg);
    let name = uniqueId('isolated-credentials');
    let created = await seedCredentials(scope, provider, { name });
    let fetched = await getCredentials(created.id);

    await expectServiceError(getCredentials(created.id, other.instance), 'not_found');
    expect(await listCredentialIds({ ids: [created.id] }, other.instance)).toEqual([]);
    expect(
      await providerAuthCredentialsService.getManyProviderAuthCredentialsByIds({
        instance: other.instance,
        ids: [created.id]
      })
    ).toEqual([]);

    await expect(
      providerAuthCredentialsService.updateProviderAuthCredentials({
        instance: other.instance,
        providerAuthCredentials: fetched,
        input: { name: uniqueId('hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      providerAuthCredentialsService.archiveProviderAuthCredentials({
        instance: other.instance,
        providerAuthCredentials: fetched
      })
    ).rejects.toThrow('Tenant mismatch');

    expect(
      await subspaceDb.providerAuthCredentials.findUniqueOrThrow({ where: { id: created.id } })
    ).toMatchObject({ name, status: 'active' });
  });
});
