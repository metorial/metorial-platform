import {
  type BootstrappedOrganization,
  createRemoteProvider,
  eventually,
  expectServiceError,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  type ProviderCombinationInput,
  providerCombinationService,
  providerDeploymentConfigPairInternalService,
  providerDeploymentInternalService
} from '../src';
import { createProviderDeployment, scopeOf, toolKeys } from './_fixtures';

describe('module-provider-internal provider combinations and deployment config pairs', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useFixture(async () => {
    let [first, second] = await Promise.all([
      createRemoteProvider(org.clients.instance, { url: server.url }),
      createRemoteProvider(org.clients.instance, { url: server.url })
    ]);

    return { first: first.providerId, second: second.providerId };
  });

  let combine = async (
    owner: BootstrappedOrganization,
    inputs: ProviderCombinationInput[]
  ) => {
    let { instance } = await scopeOf(owner);
    return await providerCombinationService.getCombinations({ instance, providers: inputs });
  };

  let combineOne = async (deploymentId: string) => {
    let [combination] = await combine(org, [{ deploymentId }]);
    return combination!;
  };

  it('resolves a deployment into a combination and creates its default config once, also concurrently', async () => {
    let deploymentId = await createProviderDeployment(org, providers.first);

    let results = await Promise.all([
      combineOne(deploymentId),
      combineOne(deploymentId),
      combineOne(deploymentId)
    ]);
    let [combination] = results;

    expect(combination!.deployment.id).toBe(deploymentId);
    expect(combination!.provider.id).toBe(providers.first);
    expect(combination!.authConfig).toBeNull();
    expect(combination!.config).toMatchObject({
      deploymentOid: combination!.deployment.oid,
      providerOid: combination!.provider.oid
    });
    expect(new Set(results.map(result => result.config.id)).size).toBe(1);

    let again = await combineOne(deploymentId);
    expect(again.config.id).toBe(combination!.config.id);
  });

  it('infers the deployment from a config', async () => {
    let deploymentId = await createProviderDeployment(org, providers.first);
    let { config } = await combineOne(deploymentId);

    let [inferred] = await combine(org, [{ configId: config.id }]);

    expect(inferred!.deployment.id).toBe(deploymentId);
    expect(inferred!.provider.id).toBe(providers.first);
    expect(inferred!.config.id).toBe(config.id);
  });

  it('rejects inputs that mix providers', async () => {
    let [firstDeploymentId, secondDeploymentId] = await Promise.all([
      createProviderDeployment(org, providers.first),
      createProviderDeployment(org, providers.second)
    ]);
    let { config } = await combineOne(firstDeploymentId);

    let error = await expectServiceError(
      combine(org, [{ configId: config.id, deploymentId: secondDeploymentId }]),
      'bad_request'
    );
    expect(error.message).toBe('Provider session inputs have mismatched providers');
  });

  it("does not resolve another tenant's deployment or config", async () => {
    let deploymentId = await createProviderDeployment(org, providers.first);
    let { config } = await combineOne(deploymentId);

    for (let input of [{ deploymentId }, { configId: config.id }]) {
      let error = await expectServiceError(combine(otherOrg, [input]), 'bad_request');
      expect(error.message).toMatch(/provide at least a provider config/);
    }
  });

  it("refuses to resolve the provider version for another tenant's environment", async () => {
    let deploymentId = await createProviderDeployment(org, providers.first);
    let { deployment, provider } = await combineOne(deploymentId);
    let { environment: otherEnvironment } = await scopeOf(otherOrg);

    await expect(
      providerDeploymentInternalService.getCurrentVersion({
        environment: otherEnvironment,
        deployment,
        provider
      })
    ).rejects.toThrow('Environment mismatch between deployment and environment');

    let error = await expectServiceError(
      providerDeploymentInternalService.getCurrentVersionOptional({
        environment: otherEnvironment,
        provider
      }),
      'bad_request'
    );
    expect(error.message).toMatch(/deployed versions in other environments/);
  });

  it('upserts one pair and one pair version per input versions, also concurrently, and discovers it on use', async () => {
    let { tenant, environment } = await scopeOf(org);
    let deploymentId = await createProviderDeployment(org, providers.second);
    let combination = await combineOne(deploymentId);
    let parts = {
      deployment: combination.deployment,
      config: combination.config,
      authConfig: combination.authConfig
    };
    let version = (await providerDeploymentInternalService.getCurrentVersion({
      environment,
      deployment: combination.deployment,
      provider: combination.provider
    }))!;

    let pairs = await Promise.all(
      [1, 2, 3].map(() =>
        providerDeploymentConfigPairInternalService.upsertDeploymentConfigPair(parts)
      )
    );
    expect(new Set(pairs.map(result => result.pair.id)).size).toBe(1);
    expect(pairs[0]!.version).toBeUndefined();

    let identifier = [
      combination.deployment.currentVersion!.oid.toString(36),
      combination.config.currentVersion!.oid.toString(36),
      '$'
    ].join('.');
    let pair = await subspaceDb.providerDeploymentConfigPair.findUniqueOrThrow({
      where: { identifier }
    });
    expect(pair).toMatchObject({
      id: pairs[0]!.pair.id,
      providerDeploymentVersionOid: combination.deployment.currentVersion!.oid,
      providerConfigVersionOid: combination.config.currentVersion!.oid,
      providerAuthConfigVersionOid: null,
      tenantOid: tenant.oid,
      environmentOid: environment.oid
    });

    let withVersion = await Promise.all(
      [1, 2, 3].map(() =>
        providerDeploymentConfigPairInternalService.upsertDeploymentConfigPair({
          ...parts,
          version
        })
      )
    );
    expect(new Set(withVersion.map(result => result.version!.id)).size).toBe(1);
    expect(
      await subspaceDb.providerDeploymentConfigPairProviderVersion.count({
        where: { pairOid: pair.oid, versionOid: version.oid }
      })
    ).toBe(1);

    let used = await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
      ...parts,
      version
    });
    expect(used.pair.id).toBe(pair.id);
    expect(used.version!.id).toBe(withVersion[0]!.version!.id);

    let pairVersion = await eventually(
      async () => {
        let pairVersion =
          await subspaceDb.providerDeploymentConfigPairProviderVersion.findUniqueOrThrow({
            where: { pairOid_versionOid: { pairOid: pair.oid, versionOid: version.oid } },
            include: { specification: true }
          });
        expect(pairVersion.specificationDiscoveryStatus).toBe('discovered');
        return pairVersion;
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );
    expect(pairVersion.specification?.type).toBe('full');
    expect(toolKeys(pairVersion.specification)).toEqual(
      expect.arrayContaining(['tool_add', 'tool_echo'])
    );

    let usedPair = await subspaceDb.providerDeploymentConfigPair.findUniqueOrThrow({
      where: { oid: pair.oid }
    });
    expect(usedPair.lastUsedPairVersionOid).toBe(pairVersion.oid);

    await eventually(async () => {
      let promoted = await subspaceDb.providerVersion.findUniqueOrThrow({
        where: { oid: version.oid },
        include: { specification: true }
      });
      expect(promoted.specification?.type).toBe('full');
    });
  }, 180_000);
});
