import { generatePlainId } from '@lowerdeck/id';
import { slugify } from '@lowerdeck/slugify';
import {
  type AdapterIntegration,
  type AdapterIntegrationInstance,
  type AdapterIntegrationInstanceProvider,
  type AdapterIntegrationProvider,
  getId,
  withTransaction
} from '@metorial-subspace/db';
import {
  isLiveAdapterInstanceStatus,
  isLiveAdapterStatus
} from '@metorial-subspace/module-integration';
import {
  enqueueChatIntegrationArchived,
  enqueueChatIntegrationCreated,
  enqueueChatIntegrationInstanceArchived,
  enqueueChatIntegrationInstanceCreated,
  enqueueChatIntegrationInstanceUpdated,
  enqueueChatIntegrationUpdated
} from '../queues/lifecycle';

let now = () => new Date();

let getSlug = (name: string) =>
  `${slugify(name)}-${generatePlainId(7).toLowerCase()}`.toLowerCase();

export let archiveChatIntegrationProjection = async (adapterIntegrationOid: bigint) => {
  return withTransaction(async db => {
    let archivedAt = now();

    await db.chatIntegrationInstanceProvider.updateMany({
      where: { adapterIntegrationOid, status: { not: 'deleted' } },
      data: { status: 'archived', archivedAt, isParentDeleted: true }
    });
    await db.chatIntegrationInstance.updateMany({
      where: { adapterIntegrationOid, status: { not: 'deleted' } },
      data: { status: 'archived', archivedAt, isParentDeleted: true }
    });
    await db.chatIntegrationProvider.updateMany({
      where: { adapterIntegrationOid, status: { not: 'deleted' } },
      data: { status: 'archived', archivedAt }
    });
    await db.chatIntegration.updateMany({
      where: { adapterIntegrationOid, status: { not: 'deleted' } },
      data: { status: 'archived', archivedAt }
    });
  });
};

export let upsertChatIntegrationProjection = async (
  adapterIntegration: AdapterIntegration,
  input?: { name?: string; description?: string | null; metadata?: Record<string, any> | null }
) => {
  return withTransaction(async db => {
    if (!isLiveAdapterStatus(adapterIntegration.status)) {
      await archiveChatIntegrationProjection(adapterIntegration.oid);
      let archived = await db.chatIntegration.findUnique({
        where: { adapterIntegrationOid: adapterIntegration.oid }
      });
      if (archived) await enqueueChatIntegrationArchived(archived.id);
      return archived;
    }

    let existing = await db.chatIntegration.findUnique({
      where: { adapterIntegrationOid: adapterIntegration.oid }
    });
    if (existing) {
      if (existing.status === 'archived') {
        let restored = await db.chatIntegration.update({
          where: { oid: existing.oid },
          data: {
            status: 'active',
            archivedAt: null
          }
        });
        await enqueueChatIntegrationUpdated(restored.id);
        return restored;
      }
      if (existing.status === 'deleted') return existing;
      await enqueueChatIntegrationUpdated(existing.id);
      return existing;
    }

    let integration = await db.integration.findUniqueOrThrow({
      where: { oid: adapterIntegration.integrationOid }
    });
    let name = input?.name?.trim() || integration.name;

    let created = await db.chatIntegration.create({
      data: {
        ...getId('chatIntegration'),
        status: 'active',
        slug: getSlug(name),
        name,
        description: input?.description?.trim() || null,
        metadata: input?.metadata ?? {},
        adapterIntegrationOid: adapterIntegration.oid,
        tenantOid: adapterIntegration.tenantOid,
        projectOid: adapterIntegration.projectOid,
        environmentOid: adapterIntegration.environmentOid,
        instanceOid: adapterIntegration.instanceOid,
        solutionOid: adapterIntegration.solutionOid
      }
    });
    await enqueueChatIntegrationCreated(created.id);
    return created;
  });
};

export let upsertChatProviderProjection = async (
  adapterProvider: AdapterIntegrationProvider
) => {
  return withTransaction(async db => {
    let chatIntegration = await db.chatIntegration.findUnique({
      where: { adapterIntegrationOid: adapterProvider.adapterIntegrationOid }
    });
    if (!chatIntegration) return null;

    let existing = await db.chatIntegrationProvider.findUnique({
      where: { adapterIntegrationProviderOid: adapterProvider.oid }
    });

    if (!isLiveAdapterStatus(adapterProvider.status)) {
      if (!existing || existing.status === 'deleted') return existing;
      let archived = await db.chatIntegrationProvider.update({
        where: { oid: existing.oid },
        data: { status: 'archived', archivedAt: now() }
      });
      await enqueueChatIntegrationUpdated(chatIntegration.id);
      return archived;
    }

    let integrationProvider = await db.integrationProvider.findUnique({
      where: { oid: adapterProvider.integrationProviderOid }
    });
    let name = existing?.name || integrationProvider?.name || 'Provider';

    if (existing) {
      if (existing.status === 'deleted') return existing;
      let updated = await db.chatIntegrationProvider.update({
        where: { oid: existing.oid },
        data: { status: 'active', archivedAt: null, name }
      });
      await enqueueChatIntegrationUpdated(chatIntegration.id);
      return updated;
    }

    let created = await db.chatIntegrationProvider.create({
      data: {
        ...getId('chatIntegrationProvider'),
        status: 'active',
        name,
        description: integrationProvider?.description ?? null,
        metadata: {},
        chatIntegrationOid: chatIntegration.oid,
        adapterIntegrationOid: adapterProvider.adapterIntegrationOid,
        adapterIntegrationProviderOid: adapterProvider.oid,
        tenantOid: adapterProvider.tenantOid,
        projectOid: adapterProvider.projectOid,
        environmentOid: adapterProvider.environmentOid,
        instanceOid: adapterProvider.instanceOid,
        solutionOid: adapterProvider.solutionOid
      }
    });
    await enqueueChatIntegrationUpdated(chatIntegration.id);
    return created;
  });
};

export let upsertChatInstanceProjection = async (
  adapterInstance: AdapterIntegrationInstance,
  input?: { name?: string; description?: string | null; metadata?: Record<string, any> | null }
) => {
  return withTransaction(async db => {
    let chatIntegration = await db.chatIntegration.findUnique({
      where: { adapterIntegrationOid: adapterInstance.adapterIntegrationOid }
    });
    if (!chatIntegration) return null;

    let existing = await db.chatIntegrationInstance.findUnique({
      where: { adapterIntegrationInstanceOid: adapterInstance.oid }
    });

    if (!isLiveAdapterInstanceStatus(adapterInstance.status)) {
      if (!existing || existing.status === 'deleted') return existing;
      let archived = await db.chatIntegrationInstance.update({
        where: { oid: existing.oid },
        data: {
          status: 'archived',
          archivedAt: now(),
          isParentDeleted: chatIntegration.status !== 'active'
        }
      });
      await enqueueChatIntegrationInstanceArchived(archived.id);
      return archived;
    }

    let integrationInstance = await db.integrationInstance.findUnique({
      where: { oid: adapterInstance.integrationInstanceOid }
    });
    let name = input?.name?.trim() || existing?.name || integrationInstance?.name || 'Instance';
    let status = adapterInstance.status;

    if (existing) {
      if (existing.status === 'deleted') return existing;
      let updated = await db.chatIntegrationInstance.update({
        where: { oid: existing.oid },
        data: {
          status,
          archivedAt: null,
          isParentDeleted: false,
          name
        }
      });
      await enqueueChatIntegrationInstanceUpdated(updated.id);
      return updated;
    }

    let created = await db.chatIntegrationInstance.create({
      data: {
        ...getId('chatIntegrationInstance'),
        status,
        name,
        description: input?.description?.trim() || integrationInstance?.description || null,
        metadata: input?.metadata ?? {},
        chatIntegrationOid: chatIntegration.oid,
        adapterIntegrationInstanceOid: adapterInstance.oid,
        adapterIntegrationOid: adapterInstance.adapterIntegrationOid,
        tenantOid: adapterInstance.tenantOid,
        projectOid: adapterInstance.projectOid,
        environmentOid: adapterInstance.environmentOid,
        instanceOid: adapterInstance.instanceOid,
        solutionOid: adapterInstance.solutionOid
      }
    });
    await enqueueChatIntegrationInstanceCreated(created.id);
    return created;
  });
};

export let upsertChatInstanceProviderProjection = async (
  adapterInstanceProvider: AdapterIntegrationInstanceProvider
) => {
  return withTransaction(async db => {
    let chatInstance = await db.chatIntegrationInstance.findUnique({
      where: {
        adapterIntegrationInstanceOid: adapterInstanceProvider.adapterIntegrationInstanceOid
      }
    });
    let chatProvider = await db.chatIntegrationProvider.findUnique({
      where: {
        adapterIntegrationProviderOid: adapterInstanceProvider.adapterIntegrationProviderOid
      }
    });
    let chatIntegration = await db.chatIntegration.findUnique({
      where: { adapterIntegrationOid: adapterInstanceProvider.adapterIntegrationOid }
    });
    if (!chatInstance || !chatProvider || !chatIntegration) return null;

    let existing = await db.chatIntegrationInstanceProvider.findUnique({
      where: {
        adapterIntegrationInstanceProviderOid: adapterInstanceProvider.oid
      }
    });

    if (!isLiveAdapterStatus(adapterInstanceProvider.status)) {
      if (!existing || existing.status === 'deleted') return existing;
      let archived = await db.chatIntegrationInstanceProvider.update({
        where: { oid: existing.oid },
        data: { status: 'archived', archivedAt: now() }
      });
      await enqueueChatIntegrationInstanceUpdated(chatInstance.id);
      return archived;
    }

    if (existing) {
      if (existing.status === 'deleted') return existing;
      let updated = await db.chatIntegrationInstanceProvider.update({
        where: { oid: existing.oid },
        data: { status: 'active', archivedAt: null, isParentDeleted: false }
      });
      await enqueueChatIntegrationInstanceUpdated(chatInstance.id);
      return updated;
    }

    let created = await db.chatIntegrationInstanceProvider.create({
      data: {
        ...getId('chatIntegrationInstanceProvider'),
        status: 'active',
        name: chatProvider.name,
        chatIntegrationInstanceOid: chatInstance.oid,
        chatIntegrationProviderOid: chatProvider.oid,
        chatIntegrationOid: chatIntegration.oid,
        adapterIntegrationInstanceProviderOid: adapterInstanceProvider.oid,
        adapterIntegrationInstanceOid: adapterInstanceProvider.adapterIntegrationInstanceOid,
        adapterIntegrationProviderOid: adapterInstanceProvider.adapterIntegrationProviderOid,
        adapterIntegrationOid: adapterInstanceProvider.adapterIntegrationOid,
        tenantOid: adapterInstanceProvider.tenantOid,
        projectOid: adapterInstanceProvider.projectOid,
        environmentOid: adapterInstanceProvider.environmentOid,
        instanceOid: adapterInstanceProvider.instanceOid,
        solutionOid: adapterInstanceProvider.solutionOid
      }
    });
    await enqueueChatIntegrationInstanceUpdated(chatInstance.id);
    return created;
  });
};

export let projectChatFromAdapterIntegration = async (
  adapterIntegration: AdapterIntegration
) => {
  await upsertChatIntegrationProjection(adapterIntegration);

  await withTransaction(async db => {
    let providers = await db.adapterIntegrationProvider.findMany({
      where: { adapterIntegrationOid: adapterIntegration.oid }
    });
    for (let provider of providers) {
      await upsertChatProviderProjection(provider);
    }

    let instances = await db.adapterIntegrationInstance.findMany({
      where: { adapterIntegrationOid: adapterIntegration.oid }
    });
    for (let instance of instances) {
      await upsertChatInstanceProjection(instance);
      let instanceProviders = await db.adapterIntegrationInstanceProvider.findMany({
        where: { adapterIntegrationInstanceOid: instance.oid }
      });
      for (let instanceProvider of instanceProviders) {
        await upsertChatInstanceProviderProjection(instanceProvider);
      }
    }
  });
};

export { getSlug };
