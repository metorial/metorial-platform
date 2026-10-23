import {
  eventually,
  expectOk,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { integrationEnclaveService, integrationInternetGatewayService } from '../src';
import {
  createDeployableProvider,
  createEnclave,
  facingFor,
  readCompiledRules,
  unrestrictedRules,
  workerTimeout,
  type Organization
} from './_fixtures';

let ids = (items: { id: string }[]) => items.map(item => item.id).sort();

let listEnclaves = async (
  org: Organization,
  params: Omit<Parameters<typeof integrationEnclaveService.listEnclaves>[0], 'instance'> = {}
) => {
  let { instance } = await facingFor(org);

  return firstPage(await integrationEnclaveService.listEnclaves({ instance, ...params }));
};

describe('module-enclave enclaves', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let providerPromise: ReturnType<typeof createDeployableProvider> | undefined;
  let provider = () => (providerPromise ??= createDeployableProvider(org, server.url));

  it('lists, filters and fetches the enclaves of the instance', async () => {
    let { instance } = await facingFor(org);
    let gateway = await integrationInternetGatewayService.get({ instance });
    let { providerId } = await provider();
    let other = await createDeployableProvider(org, server.url);

    let first = await createEnclave(org, providerId);
    let second = await createEnclave(org, providerId);
    let third = await createEnclave(org, other.providerId);

    expect(ids(await listEnclaves(org, { providerIds: [providerId] }))).toEqual(
      expect.arrayContaining([first.enclave.id, second.enclave.id])
    );
    expect(ids(await listEnclaves(org, { providerIds: [other.providerId] }))).toEqual([
      third.enclave.id
    ]);
    expect(
      ids(await listEnclaves(org, { providerDeploymentIds: [first.deployment.id] }))
    ).toEqual([first.enclave.id]);
    expect(
      ids(await listEnclaves(org, { ids: [first.enclave.id, third.enclave.id] }))
    ).toEqual([first.enclave.id, third.enclave.id].sort());
    expect(ids(await listEnclaves(org, { slugs: [second.enclave.slug] }))).toEqual([
      second.enclave.id
    ]);
    expect(
      ids(
        await listEnclaves(org, { internetGatewayIds: [gateway.id], ids: [third.enclave.id] })
      )
    ).toEqual([third.enclave.id]);
    expect(await listEnclaves(org, { ids: [uniqueId('missing')] })).toEqual([]);

    let fetched = await integrationEnclaveService.getEnclaveById({
      instance,
      enclaveId: first.enclave.id
    });
    expect(fetched).toMatchObject({
      id: first.enclave.id,
      slug: first.enclave.slug,
      internetGateway: { id: gateway.id },
      providerDeployment: { id: first.deployment.id, provider: { id: providerId } }
    });

    await expectServiceError(
      integrationEnclaveService.getEnclaveById({ instance, enclaveId: uniqueId('missing') }),
      'not_found'
    );
  });

  it('hides enclaves of archived deployments from the default list', async () => {
    let { instance } = await facingFor(org);
    let { providerId } = await provider();
    let { deployment, enclave } = await createEnclave(org, providerId);

    expectOk(await org.clients.instance.delete(`/provider-deployments/${deployment.id}`));

    expect(await listEnclaves(org, { ids: [enclave.id] })).toEqual([]);
    expect(ids(await listEnclaves(org, { providerDeploymentIds: [deployment.id] }))).toEqual([
      enclave.id
    ]);
    expect(
      (await integrationEnclaveService.getEnclaveById({ instance, enclaveId: enclave.id })).id
    ).toBe(enclave.id);
  });

  it('updates the name and description and invalidates the compiled rules', async () => {
    let { instance } = await facingFor(org);
    let { providerId } = await provider();
    let { enclave } = await createEnclave(org, providerId);

    expect(await readCompiledRules(org, enclave.id)).toEqual(unrestrictedRules);
    let compiled = await integrationEnclaveService.getEnclaveById({
      instance,
      enclaveId: enclave.id
    });

    let renamed = await integrationEnclaveService.updateEnclave({
      instance,
      enclave: compiled,
      input: { name: 'Renamed enclave', description: 'Handles e2e traffic' }
    });
    expect(renamed).toMatchObject({
      id: enclave.id,
      slug: enclave.slug,
      name: 'Renamed enclave',
      description: 'Handles e2e traffic'
    });

    let unchanged = await integrationEnclaveService.updateEnclave({
      instance,
      enclave: renamed,
      input: {}
    });
    expect(unchanged).toMatchObject({
      name: 'Renamed enclave',
      description: 'Handles e2e traffic'
    });

    await eventually(async () => {
      let stored = await subspaceDb.integrationEnclave.findUniqueOrThrow({
        where: { id: enclave.id }
      });
      expect(stored.compiledNetworkRules).toBeNull();
      expect(stored.needsEnclaveReconciliation).toBe(true);
    }, workerTimeout);

    expect(await readCompiledRules(org, enclave.id)).toEqual(unrestrictedRules);
  });

  it('records usage and lists the most recently used enclaves first', async () => {
    let { instance } = await facingFor(org);
    let { providerId } = await provider();
    let { enclave: first } = await createEnclave(org, providerId);
    let { enclave: second } = await createEnclave(org, providerId);

    expect(first.lastUsedAt).toBeNull();

    expect(await integrationEnclaveService.useEnclave({ instance, enclave: first })).toEqual(
      unrestrictedRules
    );
    let used = await integrationEnclaveService.getEnclaveById({
      instance,
      enclaveId: first.id
    });
    expect(used.lastUsedAt).toBeInstanceOf(Date);

    await integrationEnclaveService.useEnclave({ instance, enclave: used });
    expect(
      (await integrationEnclaveService.getEnclaveById({ instance, enclaveId: first.id }))
        .lastUsedAt
    ).toEqual(used.lastUsedAt);

    await integrationEnclaveService.useEnclave({ instance, enclave: second });

    let recent = await integrationEnclaveService.getLastUsedEnclaves({ instance });
    expect(recent.map(enclave => enclave.id).slice(0, 2)).toEqual([second.id, first.id]);
    expect(
      (await integrationEnclaveService.getLastUsedEnclaves({ instance, limit: 1 })).map(
        enclave => enclave.id
      )
    ).toEqual([second.id]);
    expect(
      await integrationEnclaveService.getLastUsedEnclaves({ instance, limit: 0 })
    ).toHaveLength(1);
  });

  it('keeps enclaves inside the owning instance', async () => {
    let { instance: otherInstance } = await facingFor(otherOrg);
    let { providerId } = await provider();
    let { deployment, enclave } = await createEnclave(org, providerId);

    await expectServiceError(
      integrationEnclaveService.getEnclaveById({
        instance: otherInstance,
        enclaveId: enclave.id
      }),
      'not_found'
    );
    expect(await listEnclaves(otherOrg)).toEqual([]);
    expect(await listEnclaves(otherOrg, { ids: [enclave.id] })).toEqual([]);
    expect(await listEnclaves(otherOrg, { providerDeploymentIds: [deployment.id] })).toEqual(
      []
    );
    expect(
      await integrationEnclaveService.getLastUsedEnclaves({ instance: otherInstance })
    ).toEqual([]);

    await expect(
      integrationEnclaveService.updateEnclave({
        instance: otherInstance,
        enclave,
        input: { name: 'Hijacked' }
      })
    ).rejects.toThrow('Tenant mismatch');
    expect(
      (await subspaceDb.integrationEnclave.findUniqueOrThrow({ where: { id: enclave.id } }))
        .name
    ).not.toBe('Hijacked');
  });
});
