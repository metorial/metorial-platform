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
import {
  providerAuthConfigService,
  providerAuthExportService,
  providerAuthImportService,
  providerSetupSessionService
} from '../src';
import {
  type AuthProvider,
  type AuthScope,
  createAuthProvider,
  createProviderDeployment,
  importContext,
  loadAuthScope,
  loadDiscoveredVersion,
  loadProviderDeployment,
  type SeededAuthMethod,
  seedAuthConfig,
  seedAuthMethod
} from './fixtures';

describe('module-auth provider auth configs', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let scope: AuthScope;
  let bareProvider: AuthProvider;
  let provider: AuthProvider;
  let tokenMethod: SeededAuthMethod;
  let oauthMethod: SeededAuthMethod;

  beforeAll(async () => {
    scope = await loadAuthScope(org);
    bareProvider = await createAuthProvider(org, server.url);
    provider = await createAuthProvider(org, server.url);
    await loadDiscoveredVersion(scope, bareProvider);

    tokenMethod = await seedAuthMethod(scope, provider, { type: 'token', isDefault: true });
    oauthMethod = await seedAuthMethod(scope, provider, { type: 'oauth', isDefault: false });
  });

  let getConfig = (providerAuthConfigId: string, instance = scope.instance) =>
    providerAuthConfigService.getProviderAuthConfigById({ instance, providerAuthConfigId });

  let listConfigIds = async (
    input: Omit<
      Parameters<typeof providerAuthConfigService.listProviderAuthConfigs>[0],
      'instance'
    >,
    instance = scope.instance
  ) =>
    (
      await firstPage(
        await providerAuthConfigService.listProviderAuthConfigs({ instance, ...input })
      )
    ).map(item => item.id);

  it('rejects auth configs for a provider without an auth method and persists nothing', async () => {
    let create = (input: Record<string, any>) =>
      providerAuthConfigService.createProviderAuthConfig({
        instance: scope.instance,
        provider: bareProvider,
        source: 'manual',
        import: importContext,
        input: { config: { accessToken: uniqueId('token') }, ...input }
      });

    let unsupported = await expectServiceError(create({}), 'bad_request');
    expect(unsupported.message).toMatch(/does not support authentication/);

    await expectServiceError(
      create({ authMethodId: uniqueId('missing-method') }),
      'invalid_auth_method'
    );
    await expectServiceError(
      create({ isDefault: true }),
      'default_config_requires_deployment'
    );

    expect(
      await subspaceDb.providerAuthConfig.count({ where: { providerOid: bareProvider.oid } })
    ).toBe(0);
  });

  it('resolves the auth config schema of the provider auth method', async () => {
    await expectServiceError(
      providerAuthConfigService.getProviderAuthConfigSchema({ instance: scope.instance }),
      'missing_provider_information'
    );
    await expectServiceError(
      providerAuthConfigService.getProviderAuthConfigSchema({
        instance: scope.instance,
        provider: bareProvider
      }),
      'bad_request'
    );

    let byDefault = await providerAuthConfigService.getProviderAuthConfigSchema({
      instance: scope.instance,
      provider
    });
    expect(byDefault.provider.id).toBe(provider.id);
    expect(byDefault.authMethod.id).toBe(tokenMethod.id);
    expect(byDefault.specification.oid).toBe(tokenMethod.specificationOid);

    let byKey = await providerAuthConfigService.getProviderAuthConfigSchema({
      instance: scope.instance,
      provider,
      authMethodId: oauthMethod.key
    });
    expect(byKey.authMethod.id).toBe(oauthMethod.id);
  });

  it('enforces the tenant policy and backend input validation before storing anything', async () => {
    let name = uniqueId('rejected-auth-config');
    let token = uniqueId('secret-token');

    await expectServiceError(
      providerAuthConfigService.createProviderAuthConfigInternal({
        tenant: { ...scope.tenant, onlyAllowOAuthAuthMethods: true },
        environment: scope.environment,
        provider,
        source: 'manual',
        import: importContext,
        input: { name, config: { accessToken: token } }
      }),
      'non_oauth_auth_method_not_allowed'
    );

    let invalidInput = await expectServiceError(
      providerAuthConfigService.createProviderAuthConfig({
        instance: scope.instance,
        provider,
        source: 'manual',
        import: importContext,
        input: { name, config: { token } }
      }),
      'bad_request'
    );
    expect(invalidInput.message).toMatch(/accessToken/);

    let rejected = await providerAuthConfigService
      .createProviderAuthConfig({
        instance: scope.instance,
        provider,
        source: 'manual',
        import: importContext,
        input: { name, config: { accessToken: token } }
      })
      .then(
        () => null,
        error => error
      );
    expect(rejected).toBeInstanceOf(Error);
    expect(JSON.stringify({ message: rejected.message, data: rejected.data })).not.toContain(
      token
    );

    expect(await subspaceDb.providerAuthConfig.count({ where: { name } })).toBe(0);
  });

  it('creates, resolves, lists and updates an auth config', async () => {
    let name = uniqueId('auth-config');
    let created = await seedAuthConfig(scope, provider, tokenMethod, {
      name,
      description: 'Initial',
      metadata: { team: 'a' }
    });

    let row = await subspaceDb.providerAuthConfig.findUniqueOrThrow({
      where: { id: created.id },
      include: { currentVersion: true, providerAuthImports: true }
    });
    expect(row).toMatchObject({
      name,
      description: 'Initial',
      metadata: { team: 'a' },
      status: 'active',
      type: 'manual',
      source: 'manual',
      isDefault: false,
      isEphemeral: false,
      tenantOid: scope.tenant.oid,
      environmentOid: scope.environment.oid,
      providerOid: provider.oid,
      authMethodOid: tokenMethod.oid,
      toolFilter: { type: 'v1.allow_all' }
    });
    expect(row.currentVersion?.oid).toBe(created.currentVersion.oid);
    expect(row.providerAuthImports.map(item => item.id)).toEqual([created.authImport!.id]);

    let fetched = await getConfig(created.id);
    expect(fetched.authMethod.id).toBe(tokenMethod.id);
    expect(fetched.authMethod.specification).not.toHaveProperty('value');

    expect(await listConfigIds({ providerIds: [provider.id] })).toContain(created.id);
    expect(await listConfigIds({ ids: [created.id] })).toEqual([created.id]);
    expect(await listConfigIds({ ids: [created.id], providerIds: [bareProvider.id] })).toEqual(
      []
    );

    let updated = await providerAuthConfigService.updateProviderAuthConfig({
      instance: scope.instance,
      auditScope: scope.fixture.auditScope,
      providerAuthConfig: fetched,
      import: importContext,
      input: { name: `${name} renamed`, metadata: { team: 'b' } }
    });
    expect(updated).toMatchObject({
      name: `${name} renamed`,
      description: 'Initial',
      metadata: { team: 'b' }
    });
    expect(updated.authImport).toBeUndefined();

    let updatedRow = await subspaceDb.providerAuthConfig.findUniqueOrThrow({
      where: { id: created.id }
    });
    expect(updatedRow).toMatchObject({
      name: `${name} renamed`,
      currentVersionOid: row.currentVersionOid
    });

    await eventually(async () => {
      let use = await subspaceDb.providerUse.findFirstOrThrow({
        where: { tenantOid: scope.tenant.oid, providerOid: provider.oid }
      });
      expect(use.authConfigs).toBeGreaterThanOrEqual(1);
    });
  });

  it('rejects auth method changes and updates of automated OAuth configs', async () => {
    let manual = await getConfig((await seedAuthConfig(scope, provider, tokenMethod)).id);
    let automated = await getConfig(
      (await seedAuthConfig(scope, provider, oauthMethod, { type: 'oauth_automated' })).id
    );

    await expectServiceError(
      providerAuthConfigService.updateProviderAuthConfig({
        instance: scope.instance,
        providerAuthConfig: manual,
        import: importContext,
        input: { authMethodId: oauthMethod.id }
      }),
      'cannot_change_auth_method'
    );
    await expectServiceError(
      providerAuthConfigService.updateProviderAuthConfig({
        instance: scope.instance,
        providerAuthConfig: automated,
        import: importContext,
        input: { name: uniqueId('renamed') }
      }),
      'cannot_update_automated_oauth_config'
    );

    expect(
      await subspaceDb.providerAuthConfig.findUniqueOrThrow({ where: { id: automated.id } })
    ).toMatchObject({ name: automated.name, authMethodOid: oauthMethod.oid });
  });

  it('hides ephemeral auth configs from lists but resolves them by id', async () => {
    let ephemeral = await seedAuthConfig(scope, provider, tokenMethod, { isEphemeral: true });

    expect((await getConfig(ephemeral.id)).isEphemeral).toBe(true);
    expect(await listConfigIds({ ids: [ephemeral.id] })).toEqual([]);
  });

  it('resolves an auth config through the setup session it was set on', async () => {
    let authConfig = await seedAuthConfig(scope, provider, tokenMethod);
    let session = await providerSetupSessionService.createProviderSetupSession({
      instance: scope.instance,
      import: importContext,
      input: { type: 'auto', uiMode: 'metorial_elements' }
    });
    await subspaceDb.providerSetupSession.update({
      where: { oid: session.oid },
      data: { authConfigOid: authConfig.oid }
    });

    expect((await getConfig(session.id)).id).toBe(authConfig.id);
  });

  it('archives an auth config and rejects further changes', async () => {
    let created = await seedAuthConfig(scope, provider, tokenMethod);

    let archived = await providerAuthConfigService.archiveProviderAuthConfig({
      instance: scope.instance,
      auditScope: scope.fixture.auditScope,
      providerAuthConfig: await getConfig(created.id)
    });
    expect(archived).toMatchObject({ status: 'archived', isDefault: false });
    expect(archived.archivedAt).toBeInstanceOf(Date);

    let row = await subspaceDb.providerAuthConfig.findUniqueOrThrow({
      where: { id: created.id }
    });
    expect(row.status).toBe('archived');

    let fetched = await getConfig(created.id);
    expect(fetched.status).toBe('archived');
    expect(await listConfigIds({ ids: [created.id] })).toEqual([]);
    expect(await listConfigIds({ ids: [created.id], status: ['archived'] })).toEqual([
      created.id
    ]);

    await expectServiceError(
      providerAuthConfigService.updateProviderAuthConfig({
        instance: scope.instance,
        providerAuthConfig: fetched,
        import: importContext,
        input: { name: uniqueId('renamed') }
      }),
      'gone'
    );
    await expectServiceError(
      providerAuthConfigService.archiveProviderAuthConfig({
        instance: scope.instance,
        providerAuthConfig: fetched
      }),
      'gone'
    );
  });

  it('keeps one default auth config per deployment', async () => {
    let deployment = await createProviderDeployment(org, provider);

    let first = await seedAuthConfig(scope, provider, tokenMethod, {
      isDefault: true,
      providerDeployment: deployment
    });
    expect((await loadProviderDeployment(deployment.id)).defaultAuthConfigOid).toBe(first.oid);

    let second = await seedAuthConfig(scope, provider, tokenMethod, {
      isDefault: true,
      providerDeployment: await loadProviderDeployment(deployment.id)
    });
    expect((await loadProviderDeployment(deployment.id)).defaultAuthConfigOid).toBe(
      second.oid
    );

    let defaults = await subspaceDb.providerAuthConfig.findMany({
      where: { deploymentOid: deployment.oid, isDefault: true }
    });
    expect(defaults.map(item => item.id)).toEqual([second.id]);

    await expectServiceError(
      seedAuthConfig(scope, provider, tokenMethod, { isDefault: true }),
      'invalid_default_auth_config'
    );
    await expectServiceError(
      seedAuthConfig(scope, provider, oauthMethod, {
        isDefault: true,
        providerDeployment: await loadProviderDeployment(deployment.id)
      }),
      'invalid_default_auth_config'
    );

    let archived = await providerAuthConfigService.archiveProviderAuthConfig({
      instance: scope.instance,
      providerAuthConfig: await getConfig(second.id)
    });
    expect(archived.isDefault).toBe(false);

    await eventually(async () => {
      expect((await loadProviderDeployment(deployment.id)).defaultAuthConfigOid).toBeNull();
    });
  });

  it('records auth imports for manual auth configs and gates new imports', async () => {
    let created = await seedAuthConfig(scope, provider, tokenMethod);
    let importId = created.authImport!.id;

    let imports = await firstPage(
      await providerAuthImportService.listProviderAuthImports({
        instance: scope.instance,
        providerAuthConfigIds: [created.id]
      })
    );
    expect(imports.map(item => item.id)).toEqual([importId]);

    let fetched = await providerAuthImportService.getProviderAuthImportById({
      instance: scope.instance,
      providerAuthImportId: importId
    });
    expect(fetched).toMatchObject({
      ip: importContext.ip,
      ua: importContext.ua,
      note: 'seeded'
    });
    expect(fetched.authConfig?.id).toBe(created.id);

    let importInput = { ...importContext, config: { token: uniqueId('token') } };
    let importingTenant = { ...scope.tenant, allowAuthConfigImport: true };

    await expectServiceError(
      providerAuthImportService.createProviderAuthImportInternal({
        tenant: scope.tenant,
        environment: scope.environment,
        provider,
        input: importInput
      }),
      'forbidden'
    );
    await expectServiceError(
      providerAuthImportService.createProviderAuthImportInternal({
        tenant: importingTenant,
        environment: scope.environment,
        input: importInput
      }),
      'provider_required'
    );
    await expectServiceError(
      providerAuthImportService.createProviderAuthImportInternal({
        tenant: importingTenant,
        environment: scope.environment,
        provider: bareProvider,
        providerAuthConfig: await getConfig(created.id),
        input: importInput
      }),
      'provider_mismatch'
    );
    await expectServiceError(
      providerAuthImportService.createProviderAuthImportInternal({
        tenant: importingTenant,
        environment: scope.environment,
        provider,
        input: importInput
      }),
      'bad_request'
    );

    let schema = await providerAuthImportService.getProviderAuthImportSchemaInternal({
      tenant: importingTenant,
      environment: scope.environment,
      provider,
      input: {}
    });
    expect(schema.authMethod.id).toBe(tokenMethod.id);

    expect(
      await subspaceDb.providerAuthImport.count({ where: { authConfigOid: created.oid } })
    ).toBe(1);
  });

  it('gates auth config exports and refuses archived configs', async () => {
    let created = await seedAuthConfig(scope, provider, tokenMethod);
    let exportInput = { ...importContext, note: 'e2e export' };

    await expectServiceError(
      providerAuthExportService.createProviderAuthExportInternal({
        tenant: scope.tenant,
        environment: scope.environment,
        authConfig: created,
        input: exportInput
      }),
      'forbidden'
    );

    let archived = await providerAuthConfigService.archiveProviderAuthConfig({
      instance: scope.instance,
      providerAuthConfig: await getConfig(created.id)
    });
    await expectServiceError(
      providerAuthExportService.createProviderAuthExportInternal({
        tenant: { ...scope.tenant, allowAuthConfigExport: true },
        environment: scope.environment,
        authConfig: archived,
        input: exportInput
      }),
      'use_after_delete'
    );

    expect(
      await subspaceDb.providerAuthExport.count({ where: { authConfigOid: created.oid } })
    ).toBe(0);
  });

  it("does not expose or modify another tenant's auth configs", async () => {
    let other = await loadAuthScope(otherOrg);
    let name = uniqueId('isolated-auth-config');
    let created = await seedAuthConfig(scope, provider, tokenMethod, { name });
    let fetched = await getConfig(created.id);

    await expectServiceError(getConfig(created.id, other.instance), 'not_found');
    expect(await listConfigIds({ ids: [created.id] }, other.instance)).toEqual([]);
    expect(
      await providerAuthConfigService.getManyProviderAuthConfigsByIds({
        instance: other.instance,
        ids: [created.id]
      })
    ).toEqual([]);

    await expectServiceError(
      providerAuthImportService.getProviderAuthImportById({
        instance: other.instance,
        providerAuthImportId: created.authImport!.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await providerAuthImportService.listProviderAuthImports({
          instance: other.instance,
          ids: [created.authImport!.id]
        })
      )
    ).toEqual([]);

    await expect(
      providerAuthConfigService.updateProviderAuthConfig({
        instance: other.instance,
        providerAuthConfig: fetched,
        import: importContext,
        input: { name: uniqueId('hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      providerAuthConfigService.archiveProviderAuthConfig({
        instance: other.instance,
        providerAuthConfig: fetched
      })
    ).rejects.toThrow('Tenant mismatch');

    expect(
      await subspaceDb.providerAuthConfig.findUniqueOrThrow({ where: { id: created.id } })
    ).toMatchObject({ name, status: 'active' });
  });
});
