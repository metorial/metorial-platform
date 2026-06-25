import { canonicalize } from '@lowerdeck/canonicalize';
import { getId, Prisma, withTransaction } from '@metorial-subspace/db';
import { normalizeToolFilters } from '../../../provider-internal/src/lib/toolFilter';
export { hasMaterialIntegrationProviderChange } from './material';

export let normalizeIntegrationProviderToolFilter = (
  toolFilter?: PrismaJson.ToolFilter | null
) => normalizeToolFilters(toolFilter || null);

export let createIntegrationProviderVersion = async (d: {
  integrationProviderOid: bigint;
  status: 'active' | 'archived';
  deploymentOid: bigint;
  authMethodOid?: bigint | null;
  authCredentialsOid?: bigint | null;
  configOid?: bigint | null;
  toolFilter: PrismaJson.ToolFilter;
}) => {
  try {
    throw new Error('debug' + d.integrationProviderOid);
  } catch (e) {
    console.error('createIntegrationProviderVersion', e);
  }

  console.log('createIntegrationProviderVersion', d);

  return await withTransaction(async db => {
    let integrationProvider = await db.integrationProvider.update({
      where: { oid: d.integrationProviderOid },
      data: { currentVersionIndex: { increment: 1 } },
      select: {
        oid: true,
        currentVersionIndex: true
      }
    });

    let version = await db.integrationProviderVersion.create({
      data: {
        ...getId('integrationProviderVersion'),
        status: d.status,
        index: integrationProvider.currentVersionIndex,
        toolFilter: d.toolFilter,
        integrationProviderOid: d.integrationProviderOid,
        deploymentOid: d.deploymentOid,
        authMethodOid: d.authMethodOid,
        authCredentialsOid: d.authCredentialsOid,
        configOid: d.configOid
      }
    });

    await db.integrationProvider.updateMany({
      where: { oid: integrationProvider.oid, currentVersionIndex: version.index },
      data: { currentVersionOid: version.oid }
    });

    return version;
  });
};

export let createIntegrationVersion = async (d: { integrationOid: bigint }) => {
  return await withTransaction(async db => {
    let integration = await db.integration.update({
      where: { oid: d.integrationOid },
      data: {
        currentVersionIndex: { increment: 1 }
      },
      select: { oid: true, currentVersionIndex: true }
    });

    let version = await db.integrationVersion.create({
      data: {
        ...getId('integrationVersion'),
        status: 'active',
        index: integration.currentVersionIndex,
        integrationOid: integration.oid
      }
    });

    let providers = await db.integrationProvider.findMany({
      where: {
        integrationOid: integration.oid,
        status: 'active',
        currentVersionOid: { not: null }
      },
      select: {
        currentVersionOid: true
      }
    });

    if (providers.length) {
      await db.integrationVersionProvider.createMany({
        data: providers.map((provider: { currentVersionOid: bigint | null }) => ({
          ...getId('integrationVersionProvider'),
          integrationVersionOid: version.oid,
          integrationProviderVersionOid: provider.currentVersionOid!
        }))
      });
    }

    await db.integration.updateMany({
      where: {
        oid: integration.oid,
        currentVersionIndex: version.index
      },
      data: { currentVersionOid: version.oid }
    });

    return version;
  });
};

export let createIntegrationInstanceProviderVersion = async (d: {
  integrationInstanceProviderOid: bigint;
  status: 'active' | 'archived';
  integrationProviderVersionOid: bigint;
  configOid?: bigint | null;
  authConfigOid?: bigint | null;
  toolFilter?: PrismaJson.ToolFilter | null;
  isOverrideToolFilter?: boolean;
}) => {
  return await withTransaction(async db => {
    let current = await db.integrationInstanceProvider.findUnique({
      where: { oid: d.integrationInstanceProviderOid },
      select: {
        currentVersion: {
          select: {
            oid: true,
            status: true,
            integrationProviderVersionOid: true,
            configOid: true,
            authConfigOid: true,
            toolFilter: true,
            isOverrideToolFilter: true
          }
        }
      }
    });

    let toolFilterForStorage = d.toolFilter ?? Prisma.JsonNull;
    let toolFilterForComparison = d.toolFilter ?? null;
    let normalizedIsOverrideToolFilter = d.isOverrideToolFilter ?? false;
    if (
      current?.currentVersion?.status === d.status &&
      current.currentVersion.integrationProviderVersionOid ===
        d.integrationProviderVersionOid &&
      current.currentVersion.configOid === (d.configOid ?? null) &&
      current.currentVersion.authConfigOid === (d.authConfigOid ?? null) &&
      canonicalize(current.currentVersion.toolFilter ?? null) ===
        canonicalize(toolFilterForComparison) &&
      current.currentVersion.isOverrideToolFilter === normalizedIsOverrideToolFilter
    ) {
      return current.currentVersion;
    }

    let version = await db.integrationInstanceProviderVersion.create({
      data: {
        ...getId('integrationInstanceProviderVersion'),
        status: d.status,
        toolFilter: toolFilterForStorage,
        isOverrideToolFilter: normalizedIsOverrideToolFilter,
        integrationInstanceProviderOid: d.integrationInstanceProviderOid,
        integrationProviderVersionOid: d.integrationProviderVersionOid,
        configOid: d.configOid,
        authConfigOid: d.authConfigOid
      }
    });

    await db.integrationInstanceProvider.updateMany({
      where: { oid: d.integrationInstanceProviderOid },
      data: { currentVersionOid: version.oid }
    });

    return version;
  });
};

export let refreshIntegrationInstanceStatus = async (d: {
  integrationInstanceOid: bigint;
}) => {
  return await withTransaction(async db => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { oid: d.integrationInstanceOid },
      select: { oid: true, integrationOid: true, status: true }
    });
    if (!integrationInstance || integrationInstance.status !== 'draft')
      return integrationInstance;

    let requiredCount = await db.integrationProvider.count({
      where: {
        integrationOid: integrationInstance.integrationOid,
        status: 'active'
      }
    });
    if (requiredCount === 0) return integrationInstance;

    let setCount = await db.integrationInstanceProvider.count({
      where: {
        integrationInstanceOid: integrationInstance.oid,
        status: 'active',
        isParentDeleted: false,
        currentVersionOid: { not: null },
        integrationProvider: { status: 'active' }
      }
    });
    if (setCount < requiredCount) return integrationInstance;

    return await db.integrationInstance.update({
      where: { oid: integrationInstance.oid },
      data: {
        status: 'active',
        isHiddenDraft: false
      }
    });
  });
};
