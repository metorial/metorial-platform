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
  enqueueChatConnectionArchived,
  enqueueChatConnectionCreated,
  enqueueChatConnectionUpdated,
  enqueueChatInstanceArchived,
  enqueueChatInstanceCreated,
  enqueueChatInstanceUpdated
} from '../queues/lifecycle';
import { enqueueSyncChatWorkspacesForProvider } from '../queues/sync';
import { archiveChatsWhere, restoreChatsWhere } from './chatLifecycle';

let now = () => new Date();

let getSlug = (name: string) =>
  `${slugify(name)}-${generatePlainId(7).toLowerCase()}`.toLowerCase();

export let archiveChatConnectionProjection = async (adapterIntegrationOid: bigint) => {
  return withTransaction(async db => {
    let archivedAt = now();

    await db.chatInstanceProvider.updateMany({
      where: { adapterIntegrationOid, status: { not: 'deleted' } },
      data: { status: 'archived', archivedAt, isParentDeleted: true }
    });
    await db.chatInstance.updateMany({
      where: { adapterIntegrationOid, status: { not: 'deleted' } },
      data: { status: 'archived', archivedAt, isParentDeleted: true }
    });
    await db.chatConnectionProvider.updateMany({
      where: { adapterIntegrationOid, status: { not: 'deleted' } },
      data: { status: 'archived', archivedAt }
    });
    await db.chatConnection.updateMany({
      where: { adapterIntegrationOid, status: { not: 'deleted' } },
      data: { status: 'archived', archivedAt }
    });
    await archiveChatsWhere({ chatConnection: { adapterIntegrationOid } }, archivedAt);
  });
};

export let upsertChatConnectionProjection = async (
  adapterIntegration: AdapterIntegration,
  input?: { name?: string; description?: string | null; metadata?: Record<string, any> | null }
) => {
  return withTransaction(async db => {
    if (!isLiveAdapterStatus(adapterIntegration.status)) {
      await archiveChatConnectionProjection(adapterIntegration.oid);
      let archived = await db.chatConnection.findUnique({
        where: { adapterIntegrationOid: adapterIntegration.oid }
      });
      if (archived) await enqueueChatConnectionArchived(archived.id);
      return archived;
    }

    let existing = await db.chatConnection.findUnique({
      where: { adapterIntegrationOid: adapterIntegration.oid }
    });
    if (existing) {
      if (existing.status === 'archived') {
        let restored = await db.chatConnection.update({
          where: { oid: existing.oid },
          data: {
            status: 'active',
            archivedAt: null
          }
        });
        await enqueueChatConnectionUpdated(restored.id);
        return restored;
      }
      if (existing.status === 'deleted') return existing;
      await enqueueChatConnectionUpdated(existing.id);
      return existing;
    }

    let integration = await db.integration.findUniqueOrThrow({
      where: { oid: adapterIntegration.integrationOid }
    });
    let name = input?.name?.trim() || integration.name;

    let created = await db.chatConnection.create({
      data: {
        ...getId('chatConnection'),
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
    await enqueueChatConnectionCreated(created.id);
    return created;
  });
};

export let upsertChatProviderProjection = async (
  adapterProvider: AdapterIntegrationProvider
) => {
  return withTransaction(async db => {
    let chatConnection = await db.chatConnection.findUnique({
      where: { adapterIntegrationOid: adapterProvider.adapterIntegrationOid }
    });
    if (!chatConnection) return null;

    let existing = await db.chatConnectionProvider.findUnique({
      where: { adapterIntegrationProviderOid: adapterProvider.oid }
    });

    if (!isLiveAdapterStatus(adapterProvider.status)) {
      if (!existing || existing.status === 'deleted') return existing;
      let archived = await db.chatConnectionProvider.update({
        where: { oid: existing.oid },
        data: { status: 'archived', archivedAt: now() }
      });
      await enqueueChatConnectionUpdated(chatConnection.id);
      return archived;
    }

    let integrationProvider = await db.integrationProvider.findUnique({
      where: { oid: adapterProvider.integrationProviderOid }
    });
    let name = existing?.name || integrationProvider?.name || 'Provider';

    if (existing) {
      if (existing.status === 'deleted') return existing;
      let updated = await db.chatConnectionProvider.update({
        where: { oid: existing.oid },
        data: { status: 'active', archivedAt: null, name }
      });
      await enqueueChatConnectionUpdated(chatConnection.id);
      return updated;
    }

    let created = await db.chatConnectionProvider.create({
      data: {
        ...getId('chatConnectionProvider'),
        status: 'active',
        name,
        description: integrationProvider?.description ?? null,
        metadata: {},
        chatConnectionOid: chatConnection.oid,
        adapterIntegrationOid: adapterProvider.adapterIntegrationOid,
        adapterIntegrationProviderOid: adapterProvider.oid,
        tenantOid: adapterProvider.tenantOid,
        projectOid: adapterProvider.projectOid,
        environmentOid: adapterProvider.environmentOid,
        instanceOid: adapterProvider.instanceOid,
        solutionOid: adapterProvider.solutionOid
      }
    });
    await enqueueChatConnectionUpdated(chatConnection.id);
    return created;
  });
};

export let upsertChatInstanceProjection = async (
  adapterInstance: AdapterIntegrationInstance,
  input?: { name?: string; description?: string | null; metadata?: Record<string, any> | null }
) => {
  return withTransaction(async db => {
    let chatConnection = await db.chatConnection.findUnique({
      where: { adapterIntegrationOid: adapterInstance.adapterIntegrationOid }
    });
    if (!chatConnection) return null;

    let existing = await db.chatInstance.findUnique({
      where: { adapterIntegrationInstanceOid: adapterInstance.oid }
    });

    if (!isLiveAdapterInstanceStatus(adapterInstance.status)) {
      if (!existing || existing.status === 'deleted') return existing;
      let archived = await db.chatInstance.update({
        where: { oid: existing.oid },
        data: {
          status: 'archived',
          archivedAt: now(),
          isParentDeleted: chatConnection.status !== 'active'
        }
      });
      await archiveChatsWhere({ chatInstanceOid: archived.oid }, archived.archivedAt ?? now());
      await enqueueChatInstanceArchived(archived.id);
      return archived;
    }

    let integrationInstance = await db.integrationInstance.findUnique({
      where: { oid: adapterInstance.integrationInstanceOid }
    });
    let name =
      input?.name?.trim() || existing?.name || integrationInstance?.name || 'Instance';
    let status = adapterInstance.status;

    if (existing) {
      if (existing.status === 'deleted') return existing;
      let updated = await db.chatInstance.update({
        where: { oid: existing.oid },
        data: {
          status,
          archivedAt: null,
          isParentDeleted: false,
          name
        }
      });
      await enqueueChatInstanceUpdated(updated.id);
      return updated;
    }

    let created = await db.chatInstance.create({
      data: {
        ...getId('chatInstance'),
        status,
        name,
        description: input?.description?.trim() || integrationInstance?.description || null,
        metadata: input?.metadata ?? {},
        chatConnectionOid: chatConnection.oid,
        adapterIntegrationInstanceOid: adapterInstance.oid,
        adapterIntegrationOid: adapterInstance.adapterIntegrationOid,
        tenantOid: adapterInstance.tenantOid,
        projectOid: adapterInstance.projectOid,
        environmentOid: adapterInstance.environmentOid,
        instanceOid: adapterInstance.instanceOid,
        solutionOid: adapterInstance.solutionOid
      }
    });
    await enqueueChatInstanceCreated(created.id);
    return created;
  });
};

export let upsertChatInstanceProviderProjection = async (
  adapterInstanceProvider: AdapterIntegrationInstanceProvider
) => {
  return withTransaction(async db => {
    let chatInstance = await db.chatInstance.findUnique({
      where: {
        adapterIntegrationInstanceOid: adapterInstanceProvider.adapterIntegrationInstanceOid
      }
    });
    let chatProvider = await db.chatConnectionProvider.findUnique({
      where: {
        adapterIntegrationProviderOid: adapterInstanceProvider.adapterIntegrationProviderOid
      }
    });
    let chatConnection = await db.chatConnection.findUnique({
      where: { adapterIntegrationOid: adapterInstanceProvider.adapterIntegrationOid }
    });
    if (!chatInstance || !chatProvider || !chatConnection) return null;

    let existing = await db.chatInstanceProvider.findUnique({
      where: {
        adapterIntegrationInstanceProviderOid: adapterInstanceProvider.oid
      }
    });

    if (!isLiveAdapterStatus(adapterInstanceProvider.status)) {
      if (!existing || existing.status === 'deleted') return existing;
      let archived = await db.chatInstanceProvider.update({
        where: { oid: existing.oid },
        data: { status: 'archived', archivedAt: now() }
      });
      await archiveChatsWhere(
        { chatInstanceProviderOid: archived.oid },
        archived.archivedAt ?? now()
      );
      await enqueueChatInstanceUpdated(chatInstance.id);
      return archived;
    }

    if (existing) {
      if (existing.status === 'deleted') return existing;

      let shouldSync = existing.status !== 'active';
      let updated = await db.chatInstanceProvider.update({
        where: { oid: existing.oid },
        data: { status: 'active', archivedAt: null, isParentDeleted: false }
      });

      await restoreChatsWhere({ chatInstanceProviderOid: updated.oid });
      await enqueueChatInstanceUpdated(chatInstance.id);

      if (shouldSync) await enqueueSyncChatWorkspacesForProvider(updated.id);

      return updated;
    }

    let created = await db.chatInstanceProvider.create({
      data: {
        ...getId('chatInstanceProvider'),
        status: 'active',
        name: chatProvider.name,
        chatInstanceOid: chatInstance.oid,
        chatConnectionProviderOid: chatProvider.oid,
        chatConnectionOid: chatConnection.oid,
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

    await enqueueChatInstanceUpdated(chatInstance.id);
    await enqueueSyncChatWorkspacesForProvider(created.id);

    return created;
  });
};

export let projectChatFromAdapterIntegration = async (
  adapterIntegration: AdapterIntegration
) => {
  await upsertChatConnectionProjection(adapterIntegration);

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
