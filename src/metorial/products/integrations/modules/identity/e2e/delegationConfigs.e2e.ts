import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type CreateIdentityDelegationConfigParams,
  identityDelegationConfigService
} from '../src';
import { identityScope, pageAll } from './_fixtures';

describe('module-identity delegation configs', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let defaultArchiveOrg = useOrganization();

  let cleanups: (() => void)[] = [];

  afterEach(() => {
    for (let cleanup of cleanups.splice(0)) cleanup();
  });

  let createConfig = async (
    input: Partial<CreateIdentityDelegationConfigParams['input']> = {}
  ) =>
    identityDelegationConfigService.createIdentityDelegationConfig({
      ...(await identityScope(org)),
      input: { name: uniqueId('config'), subDelegationBehavior: 'deny', ...input }
    });

  let getDefault = async (scope: Awaited<ReturnType<typeof identityScope>>) =>
    identityDelegationConfigService.getIdentityDelegationConfigById({
      ...scope,
      identityDelegationConfigId: 'default'
    });

  it('ensures exactly one default config per tenant, even under concurrent access', async () => {
    let scope = await identityScope(org);
    let { tenant, environment } = await resolveMetorialFacing(scope);

    let defaults = await Promise.all([
      getDefault(scope),
      getDefault(scope),
      getDefault(scope)
    ]);
    expect(new Set(defaults.map(config => config.id)).size).toBe(1);
    expect(defaults[0]).toMatchObject({
      isDefault: true,
      status: 'active',
      name: 'Default Delegation Config',
      currentVersion: { subDelegationBehavior: 'deny', subDelegationDepth: 0 }
    });

    expect(
      await subspaceDb.identityDelegationConfig.count({
        where: {
          tenantOid: tenant.oid,
          environmentOid: environment.oid,
          isDefault: true,
          status: 'active'
        }
      })
    ).toBe(1);

    let byId = await identityDelegationConfigService.getIdentityDelegationConfigById({
      ...scope,
      identityDelegationConfigId: defaults[0]!.id
    });
    expect(byId.id).toBe(defaults[0]!.id);

    let otherDefault = await getDefault(await identityScope(otherOrg));
    expect(otherDefault.id).not.toBe(defaults[0]!.id);
    expect(otherDefault.isDefault).toBe(true);
  });

  it('replaces an archived default config with a new one', async () => {
    let scope = await identityScope(defaultArchiveOrg);
    let original = await getDefault(scope);

    let archived = await identityDelegationConfigService.archiveIdentityDelegationConfig({
      ...scope,
      identityDelegationConfig: original
    });
    expect(archived.status).toBe('archived');

    let replacement = await getDefault(scope);
    expect(replacement.id).not.toBe(original.id);
    expect(replacement).toMatchObject({ isDefault: true, status: 'active' });
  });

  it('normalizes the sub-delegation depth for each behavior', async () => {
    let cases = [
      { input: { subDelegationBehavior: 'allow' as const }, depth: 1 },
      { input: { subDelegationBehavior: 'allow' as const, subDelegationDepth: 0 }, depth: 1 },
      { input: { subDelegationBehavior: 'allow' as const, subDelegationDepth: 4 }, depth: 4 },
      { input: { subDelegationBehavior: 'deny' as const, subDelegationDepth: 5 }, depth: 0 },
      {
        input: { subDelegationBehavior: 'require_consent' as const, subDelegationDepth: 3 },
        depth: 3
      }
    ];

    for (let { input, depth } of cases) {
      let config = await createConfig(input);
      expect(config.currentVersion).toMatchObject({
        subDelegationBehavior: input.subDelegationBehavior,
        subDelegationDepth: depth
      });
    }
  });

  it('creates a config with trimmed fields and a first version', async () => {
    let scope = await identityScope(org);
    let { tenant } = await resolveMetorialFacing(scope);
    let name = uniqueId('config');
    let events: string[] = [];
    cleanups.push(
      Fabric.listen('identity.delegation_config.created:after', async event => {
        events.push(event.identityDelegationConfig.id);
      })
    );

    let config = await createConfig({
      name: `  ${name}  `,
      description: '  Allows one level  ',
      metadata: { team: 'e2e' },
      subDelegationBehavior: 'allow'
    });
    expect(config).toMatchObject({
      name,
      description: 'Allows one level',
      metadata: { team: 'e2e' },
      isDefault: false,
      status: 'active'
    });
    expect(events).toContain(config.id);

    let row = await subspaceDb.identityDelegationConfig.findUniqueOrThrow({
      where: { id: config.id },
      include: { versions: true }
    });
    expect(row.tenantOid).toBe(tenant.oid);
    expect(row.versions.map(version => version.oid)).toEqual([row.currentVersionOid]);
  });

  it('adds a version on every update and keeps unspecified settings', async () => {
    let scope = await identityScope(org);
    let config = await createConfig({
      description: 'Initial',
      metadata: { step: 1 },
      subDelegationBehavior: 'allow',
      subDelegationDepth: 3
    });
    let previous: (string | null)[] = [];
    cleanups.push(
      Fabric.listen('identity.delegation_config.updated:after', async event => {
        previous.push(event.previousIdentityDelegationConfig.name);
      })
    );

    let renamed = await identityDelegationConfigService.updateIdentityDelegationConfig({
      ...scope,
      identityDelegationConfig: config,
      input: { name: `${config.name}-renamed` }
    });
    expect(renamed).toMatchObject({
      name: `${config.name}-renamed`,
      description: 'Initial',
      metadata: { step: 1 },
      currentVersion: { subDelegationBehavior: 'allow', subDelegationDepth: 3 }
    });
    expect(previous).toEqual([config.name]);

    let denied = await identityDelegationConfigService.updateIdentityDelegationConfig({
      ...scope,
      identityDelegationConfig: renamed,
      input: { subDelegationBehavior: 'deny' }
    });
    expect(denied.currentVersion).toMatchObject({
      subDelegationBehavior: 'deny',
      subDelegationDepth: 0
    });

    let allowed = await identityDelegationConfigService.updateIdentityDelegationConfig({
      ...scope,
      identityDelegationConfig: denied,
      input: { subDelegationBehavior: 'allow' }
    });
    expect(allowed.currentVersion).toMatchObject({
      subDelegationBehavior: 'allow',
      subDelegationDepth: 1
    });

    let versions = await subspaceDb.identityDelegationConfigVersion.findMany({
      where: { delegationConfigOid: config.oid },
      orderBy: { oid: 'asc' }
    });
    expect(versions).toHaveLength(4);
    expect(versions.at(-1)!.oid).toBe(allowed.currentVersionOid);
    expect(new Set(versions.map(version => version.oid)).size).toBe(4);
  });

  it('pages through configs and filters them by id and status', async () => {
    let scope = await identityScope(org);
    let configs = await Promise.all([createConfig(), createConfig(), createConfig()]);
    let ids = configs.map(config => config.id);

    let paged = await pageAll(
      await identityDelegationConfigService.listIdentityDelegationConfigs({ ...scope, ids })
    );
    expect(paged.map(item => item.id).sort()).toEqual([...ids].sort());

    await identityDelegationConfigService.archiveIdentityDelegationConfig({
      ...scope,
      identityDelegationConfig: configs[0]!
    });

    let active = await firstPage(
      await identityDelegationConfigService.listIdentityDelegationConfigs({ ...scope, ids })
    );
    expect(active.map(item => item.id).sort()).toEqual([ids[1], ids[2]].sort());

    let archived = await firstPage(
      await identityDelegationConfigService.listIdentityDelegationConfigs({
        ...scope,
        ids,
        status: ['archived']
      })
    );
    expect(archived.map(item => item.id)).toEqual([ids[0]]);
  });

  it('finds configs by search once they are indexed and drops them on archive', async () => {
    let scope = await identityScope(org);
    let token = uniqueId('srch').replace(/-/g, '');
    let config = await createConfig({ name: `Searchable ${token}` });

    let search = async (input: { status?: ['archived'] } = {}) =>
      (
        await firstPage(
          await identityDelegationConfigService.listIdentityDelegationConfigs({
            ...scope,
            search: token,
            ...input
          })
        )
      ).map(item => item.id);

    await eventually(async () => expect(await search()).toEqual([config.id]), {
      timeoutMs: 15_000,
      intervalMs: 500
    });
    expect(
      await firstPage(
        await identityDelegationConfigService.listIdentityDelegationConfigs({
          ...(await identityScope(otherOrg)),
          search: token
        })
      )
    ).toEqual([]);

    await identityDelegationConfigService.updateIdentityDelegationConfig({
      ...scope,
      identityDelegationConfig: config,
      input: { name: uniqueId('renamed') }
    });
    await eventually(async () => expect(await search()).toEqual([]), {
      timeoutMs: 15_000,
      intervalMs: 500
    });

    let renamed = await identityDelegationConfigService.updateIdentityDelegationConfig({
      ...scope,
      identityDelegationConfig:
        await identityDelegationConfigService.getIdentityDelegationConfigById({
          ...scope,
          identityDelegationConfigId: config.id
        }),
      input: { name: `Searchable ${token} again` }
    });
    await eventually(async () => expect(await search()).toEqual([config.id]), {
      timeoutMs: 15_000,
      intervalMs: 500
    });

    await identityDelegationConfigService.archiveIdentityDelegationConfig({
      ...scope,
      identityDelegationConfig: renamed
    });
    await eventually(async () => expect(await search({ status: ['archived'] })).toEqual([]), {
      timeoutMs: 15_000,
      intervalMs: 500
    });
  });

  it('refuses to update or archive an archived config but still resolves it', async () => {
    let scope = await identityScope(org);
    let archived = await identityDelegationConfigService.archiveIdentityDelegationConfig({
      ...scope,
      identityDelegationConfig: await createConfig()
    });
    let withVersion = await identityDelegationConfigService.getIdentityDelegationConfigById({
      ...scope,
      identityDelegationConfigId: archived.id
    });
    expect(withVersion.status).toBe('archived');

    await expectServiceError(
      identityDelegationConfigService.updateIdentityDelegationConfig({
        ...scope,
        identityDelegationConfig: withVersion,
        input: { name: uniqueId('renamed') }
      }),
      'gone'
    );
    await expectServiceError(
      identityDelegationConfigService.archiveIdentityDelegationConfig({
        ...scope,
        identityDelegationConfig: withVersion
      }),
      'gone'
    );
    expect(
      await subspaceDb.identityDelegationConfigVersion.count({
        where: { delegationConfigOid: archived.oid }
      })
    ).toBe(1);
  });

  it('does not resolve, list or modify configs of another tenant', async () => {
    let config = await createConfig();
    let otherScope = await identityScope(otherOrg);

    await expectServiceError(
      identityDelegationConfigService.getIdentityDelegationConfigById({
        ...otherScope,
        identityDelegationConfigId: config.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await identityDelegationConfigService.listIdentityDelegationConfigs({
          ...otherScope,
          ids: [config.id]
        })
      )
    ).toEqual([]);

    await expect(
      identityDelegationConfigService.updateIdentityDelegationConfig({
        ...otherScope,
        identityDelegationConfig: config,
        input: { name: uniqueId('hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      identityDelegationConfigService.archiveIdentityDelegationConfig({
        ...otherScope,
        identityDelegationConfig: config
      })
    ).rejects.toThrow('Tenant mismatch');

    expect(
      await subspaceDb.identityDelegationConfig.findUniqueOrThrow({ where: { id: config.id } })
    ).toMatchObject({ name: config.name, status: 'active' });
  });
});
