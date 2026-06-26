import { db } from '@metorial/db';
import { consumerProviderTemplateReadRoles } from '@metorial/module-access';
import { createQueue } from '@metorial/queue';
import { indexProviderTemplateSearchQueue } from '../search/providerTemplate';

export let providerTemplateCreatedQueue = createQueue<{ providerTemplateId: string }>({
  name: 'magic/lc/provider-template/created'
});

export let providerTemplateCreatedQueueProcessor = providerTemplateCreatedQueue.process(
  async data => {
    await indexProviderTemplateSearchQueue.add({
      providerTemplateId: data.providerTemplateId
    });
  }
);

export let providerTemplateUpdatedQueue = createQueue<{ providerTemplateId: string }>({
  name: 'magic/lc/provider-template/updated'
});

export let providerTemplateUpdatedQueueProcessor = providerTemplateUpdatedQueue.process(
  async data => {
    await indexProviderTemplateSearchQueue.add({
      providerTemplateId: data.providerTemplateId
    });
  }
);

export let providerTemplateArchivedQueue = createQueue<{ providerTemplateId: string }>({
  name: 'magic/lc/provider-template/archived'
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
