import { db } from '@metorial/db';
import { consumerProviderTemplateReadRoles } from '@metorial/module-access';
import { createQueue } from '@metorial/queue';
import { indexProviderTemplateSearchQueue } from '../search/providerTemplate';

export let providerTemplateCreatedQueue = createQueue<{ providerTemplateId: string }>({
  name: 'cons/lc/provider-template/created'
});

export let providerTemplateCreatedQueueProcessor = providerTemplateCreatedQueue.process(
  async data => {
    await indexProviderTemplateSearchQueue.add({
      providerTemplateId: data.providerTemplateId
    });
  }
);

export let providerTemplateUpdatedQueue = createQueue<{ providerTemplateId: string }>({
  name: 'cons/lc/provider-template/updated'
});

export let providerTemplateUpdatedQueueProcessor = providerTemplateUpdatedQueue.process(
  async data => {
    await indexProviderTemplateSearchQueue.add({
      providerTemplateId: data.providerTemplateId
    });
  }
);

export let providerTemplateArchivedQueue = createQueue<{ providerTemplateId: string }>({
  name: 'cons/lc/provider-template/archived'
});

export let providerTemplateArchivedQueueProcessor = providerTemplateArchivedQueue.process(
  async data => {
    let providerTemplate = await db.providerTemplate.findUnique({
      where: {
        id: data.providerTemplateId
      }
    });
    if (!providerTemplate || providerTemplate.status !== 'archived') return;

    await db.accessTagEntity.deleteMany({
      where: {
        providerTemplateOid: providerTemplate.oid,
        accessTagPolicy: {
          organizationOid: providerTemplate.organizationOid,
          roles: {
            hasSome: [...consumerProviderTemplateReadRoles]
          }
        }
      }
    });

    await indexProviderTemplateSearchQueue.add({
      providerTemplateId: data.providerTemplateId
    });
  }
);

export let enqueueProviderTemplateCreated = async (providerTemplateId: string) => {
  await providerTemplateCreatedQueue.add({ providerTemplateId }).catch(error => {
    console.error(
      '[module-consumer] Failed to enqueue provider template create lifecycle',
      error
    );
  });
};

export let enqueueProviderTemplateUpdated = async (providerTemplateId: string) => {
  await providerTemplateUpdatedQueue.add({ providerTemplateId }).catch(error => {
    console.error(
      '[module-consumer] Failed to enqueue provider template update lifecycle',
      error
    );
  });
};

export let enqueueProviderTemplateArchived = async (providerTemplateId: string) => {
  await providerTemplateArchivedQueue.add({ providerTemplateId }).catch(error => {
    console.error(
      '[module-consumer] Failed to enqueue provider template archive lifecycle',
      error
    );
  });
};
