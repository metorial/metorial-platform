import { generateCode } from '@lowerdeck/id';
import { ID, get4ByteIntId, getId } from '@metorial-subspace/db';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSubspaceControllerRootTestClient,
  type SubspaceControllerRootTestClient
} from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

type LockedVersionTestContext = {
  client: SubspaceControllerRootTestClient;
  tenantId: string;
  environmentId: string;
  providerId: string;
  version1Id: string;
  version2Id: string;
  otherProviderVersionId: string;
};

const nativeProviderType = {
  name: 'Native',
  attributes: {
    provider: 'metorial-native',
    backend: 'native',
    triggers: { status: 'disabled' },
    auth: { status: 'disabled' },
    config: { status: 'disabled' }
  }
} as const;

const createLockedVersionTestContext = async (): Promise<LockedVersionTestContext> => {
  let anonymousClient = createSubspaceControllerRootTestClient();
  let solution = await anonymousClient.solution.upsert({
    name: 'Locked Version Test Solution',
    identifier: `locked-version-solution-${generateCode(6)}`
  });

  let client = createSubspaceControllerRootTestClient({
    headers: {
      'Subspace-Solution-Id': solution.id
    }
  });

  let tenant = await client.tenant.upsert({
    name: 'Locked Version Test Tenant',
    identifier: `locked-version-tenant-${generateCode(6)}`,
    environments: [
      {
        name: 'Development',
        identifier: `locked-version-env-${generateCode(6)}`,
        type: 'development'
      }
    ]
  });

  let [tenantRecord, environmentRecord, solutionRecord] = await Promise.all([
    testDb.tenant.findUnique({ where: { id: tenant.id } }),
    testDb.environment.findFirst({ where: { tenantOid: (await testDb.tenant.findUnique({ where: { id: tenant.id } }))!.oid } }),
    testDb.solution.findUnique({ where: { id: solution.id } })
  ]);

  if (!tenantRecord || !environmentRecord || !solutionRecord) {
    throw new Error('Test setup failed to resolve tenant/environment/solution records');
  }

  let runId = generateCode(6).toLowerCase();

  let backend = await testDb.backend.upsert({
    where: { type: 'native' },
    create: {
      ...getId('backend'),
      type: 'native',
      identifier: 'native',
      name: 'Native'
    },
    update: {}
  });

  let providerType = await testDb.providerType.create({
    data: {
      oid: get4ByteIntId(),
      id: ID.generateIdSync('providerType'),
      shortKey: `lv${runId.slice(0, 3)}`,
      identifier: `locked-version-type-${runId}`,
      name: 'Locked Version Test Type',
      attributes: nativeProviderType.attributes
    }
  });

  let publisherTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: `pub-lv-${runId}`
    }
  });

  let providerTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: `pro-lv-${runId}`
    }
  });

  let publisher = await testDb.publisher.create({
    data: {
      ...getId('publisher'),
      type: 'tenant',
      identifier: `publisher-lv-${runId}`,
      name: 'Locked Version Publisher',
      description: 'Publisher for locked version tests',
      tag: publisherTag.tag,
      tenantOid: tenantRecord.oid
    }
  });

  let providerEntry = await testDb.providerEntry.create({
    data: {
      ...getId('providerEntry'),
      identifier: `entry-lv-${runId}`,
      name: 'Locked Version Provider Entry',
      description: 'Entry for locked version tests',
      publisherOid: publisher.oid
    }
  });

  let provider = await testDb.provider.create({
    data: {
      ...getId('provider'),
      access: 'public',
      status: 'active',
      identifier: `provider-lv-${runId}`,
      slug: `provider-lv-${runId}`,
      name: 'Locked Version Provider',
      description: 'Provider for locked version tests',
      tag: providerTag.tag,
      entryOid: providerEntry.oid,
      publisherOid: publisher.oid,
      typeOid: providerType.oid
    }
  });

  let variantTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: `pva-lv-${runId}`
    }
  });

  let providerVariant = await testDb.providerVariant.create({
    data: {
      ...getId('providerVariant'),
      identifier: `variant-lv-${runId}`,
      name: 'Default Variant',
      isDefault: true,
      tag: variantTag.tag,
      backendOid: backend.oid,
      providerOid: provider.oid,
      publisherOid: publisher.oid
    }
  });

  provider = await testDb.provider.update({
    where: { oid: provider.oid },
    data: { defaultVariantOid: providerVariant.oid },
    include: { defaultVariant: true }
  });

  let versionTag1 = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: `prv1-lv-${runId}`
    }
  });
  let versionTag2 = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: `prv2-lv-${runId}`
    }
  });

  let version1 = await testDb.providerVersion.create({
    data: {
      ...getId('providerVersion'),
      tag: versionTag1.tag,
      identifier: `version-1-lv-${runId}`,
      name: 'Version 1',
      specificationDiscoveryStatus: 'not_discoverable',
      backendOid: backend.oid,
      providerOid: provider.oid,
      providerVariantOid: providerVariant.oid,
      typeOid: providerType.oid,
      isCurrent: true
    }
  });

  let version2 = await testDb.providerVersion.create({
    data: {
      ...getId('providerVersion'),
      tag: versionTag2.tag,
      identifier: `version-2-lv-${runId}`,
      name: 'Version 2',
      specificationDiscoveryStatus: 'not_discoverable',
      backendOid: backend.oid,
      providerOid: provider.oid,
      providerVariantOid: providerVariant.oid,
      typeOid: providerType.oid
    }
  });

  await testDb.providerVariant.update({
    where: { oid: providerVariant.oid },
    data: { currentVersionOid: version1.oid }
  });

  let otherRunId = generateCode(6).toLowerCase();
  let otherProviderTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: `pro-other-lv-${otherRunId}`
    }
  });
  let otherProvider = await testDb.provider.create({
    data: {
      ...getId('provider'),
      access: 'public',
      status: 'active',
      identifier: `provider-other-lv-${otherRunId}`,
      slug: `provider-other-lv-${otherRunId}`,
      name: 'Other Locked Version Provider',
      description: 'Other provider for locked version tests',
      tag: otherProviderTag.tag,
      entryOid: providerEntry.oid,
      publisherOid: publisher.oid,
      typeOid: providerType.oid
    }
  });
  let otherVariantTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: `pva-other-lv-${otherRunId}`
    }
  });
  let otherVariant = await testDb.providerVariant.create({
    data: {
      ...getId('providerVariant'),
      identifier: `variant-other-lv-${otherRunId}`,
      name: 'Other Default Variant',
      isDefault: true,
      tag: otherVariantTag.tag,
      backendOid: backend.oid,
      providerOid: otherProvider.oid,
      publisherOid: publisher.oid
    }
  });
  await testDb.provider.update({
    where: { oid: otherProvider.oid },
    data: { defaultVariantOid: otherVariant.oid }
  });
  let otherVersionTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: `prv-other-lv-${otherRunId}`
    }
  });
  let otherProviderVersion = await testDb.providerVersion.create({
    data: {
      ...getId('providerVersion'),
      tag: otherVersionTag.tag,
      identifier: `version-other-lv-${otherRunId}`,
      name: 'Other Version',
      specificationDiscoveryStatus: 'not_discoverable',
      backendOid: backend.oid,
      providerOid: otherProvider.oid,
      providerVariantOid: otherVariant.oid,
      typeOid: providerType.oid
    }
  });

  return {
    client,
    tenantId: tenant.id,
    environmentId: environmentRecord.id,
    providerId: provider.id,
    version1Id: version1.id,
    version2Id: version2.id,
    otherProviderVersionId: otherProviderVersion.id
  };
};

const createDeployment = async (ctx: LockedVersionTestContext, opts?: { isEphemeral?: boolean }) => {
  return await ctx.client.providerDeployment.create({
    tenantId: ctx.tenantId,
    environmentId: ctx.environmentId,
    providerId: ctx.providerId,
    lockedProviderVersionId: ctx.version1Id,
    isEphemeral: opts?.isEphemeral,
    name: `Deployment ${generateCode(4)}`
  });
};

describe('providerDeployment.lockedVersion.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('updates the locked version to a different provider version', async () => {
    let ctx = await createLockedVersionTestContext();
    let deployment = await createDeployment(ctx);

    expect(deployment.lockedVersion?.id).toBe(ctx.version1Id);

    let updated = await ctx.client.providerDeployment.update({
      tenantId: ctx.tenantId,
      environmentId: ctx.environmentId,
      providerDeploymentId: deployment.id,
      lockedProviderVersionId: ctx.version2Id
    });

    expect(updated.lockedVersion?.id).toBe(ctx.version2Id);

    let versionCount = await testDb.providerDeploymentVersion.count({
      where: { deployment: { id: deployment.id } }
    });
    expect(versionCount).toBe(2);
  });

  it('unlocks the deployment when lockedProviderVersionId is null', async () => {
    let ctx = await createLockedVersionTestContext();
    let deployment = await createDeployment(ctx);

    let updated = await ctx.client.providerDeployment.update({
      tenantId: ctx.tenantId,
      environmentId: ctx.environmentId,
      providerDeploymentId: deployment.id,
      lockedProviderVersionId: null
    });

    expect(updated.lockedVersion).toBeNull();
  });

  it('rejects a locked version from a different provider', async () => {
    let ctx = await createLockedVersionTestContext();
    let deployment = await createDeployment(ctx);

    await expect(
      ctx.client.providerDeployment.update({
        tenantId: ctx.tenantId,
        environmentId: ctx.environmentId,
        providerDeploymentId: deployment.id,
        lockedProviderVersionId: ctx.otherProviderVersionId
      })
    ).rejects.toThrow(/does not belong to this deployment provider/i);
  });

  it('rejects locked version updates on ephemeral deployments', async () => {
    let ctx = await createLockedVersionTestContext();
    let deployment = await createDeployment(ctx, { isEphemeral: true });

    await expect(
      ctx.client.providerDeployment.update({
        tenantId: ctx.tenantId,
        environmentId: ctx.environmentId,
        providerDeploymentId: deployment.id,
        lockedProviderVersionId: ctx.version2Id
      })
    ).rejects.toThrow(/ephemeral provider deployment/i);
  });

  it('does not create a new deployment version row when the lock is unchanged', async () => {
    let ctx = await createLockedVersionTestContext();

    let tenantRecord = await testDb.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
    let environmentRecord = await testDb.environment.findUniqueOrThrow({
      where: { id: ctx.environmentId }
    });
    let solutionRecord = await testDb.solution.findFirstOrThrow();
    let provider = await testDb.provider.findUniqueOrThrow({
      where: { id: ctx.providerId },
      include: { defaultVariant: true }
    });
    let lockedVersion = await testDb.providerVersion.findUniqueOrThrow({
      where: { id: ctx.version1Id }
    });

    let deployment = await providerDeploymentService.createProviderDeployment({
      tenant: tenantRecord,
      solution: solutionRecord,
      environment: environmentRecord,
      provider,
      lockedVersion,
      input: {
        name: 'No-op deployment',
        config: { type: 'none' }
      }
    });

    let versionCountBefore = await testDb.providerDeploymentVersion.count({
      where: { deploymentOid: deployment.oid }
    });
    expect(versionCountBefore).toBe(1);

    let updated = await ctx.client.providerDeployment.update({
      tenantId: ctx.tenantId,
      environmentId: ctx.environmentId,
      providerDeploymentId: deployment.id,
      lockedProviderVersionId: ctx.version1Id
    });

    expect(updated.lockedVersion?.id).toBe(ctx.version1Id);

    let versionCountAfter = await testDb.providerDeploymentVersion.count({
      where: { deploymentOid: deployment.oid }
    });
    expect(versionCountAfter).toBe(1);
  });
});
