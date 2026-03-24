import { canonicalize } from '@lowerdeck/canonicalize';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  getId,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { createTag } from '../lib/createTag';
import { publisherCreatedQueue, publisherUpdatedQueue } from '../queues/lifecycle/publisher';

class publisherInternalServiceImpl {
  async upsertPublisherForTenant(d: { tenant: Tenant }) {
    let brand = await db.brand.findFirst({
      where: { tenantOid: d.tenant.oid }
    });

    return this.upsertPublisher({
      owner: { type: 'tenant', tenant: d.tenant },
      input: {
        identifier: `tenant::${d.tenant.id}`,
        name: d.tenant.name,
        image: brand?.image ?? undefined
      }
    });
  }

  async upsertPublisherForMetorial() {
    return this.upsertPublisher({
      owner: { type: 'metorial' },
      input: {
        identifier: `metorial`,
        name: `Metorial`,
        image: {
          type: 'url',
          url: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
        }
      }
    });
  }

  async upsertPublisherForExternal(d: {
    identifier: string;
    name: string;
    description?: string;
    imageUrl?: string;
  }) {
    return this.upsertPublisher({
      owner: { type: 'external' },
      input: {
        identifier: `ext::${d.identifier}`,
        name: d.name,
        description: d.description,
        image: d.imageUrl ? { type: 'url', url: d.imageUrl } : undefined
      }
    });
  }

  async upsertUnknownPublisher() {
    return this.upsertPublisher({
      owner: { type: 'external' },
      input: {
        identifier: `int::unknown`,
        name: `Unknown Publisher`
      }
    });
  }

  private async upsertPublisher(d: {
    owner: { type: 'tenant'; tenant: Tenant } | { type: 'metorial' } | { type: 'external' };
    input: {
      name: string;
      identifier: string;
      description?: string;
      source?: PrismaJson.PublisherSource;
      image?: PrismaJson.EntityImage;
    };
  }) {
    let publisher = await db.publisher.findFirst({
      where: {
        identifier: d.input.identifier,
        tenantOid: d.owner.type === 'tenant' ? d.owner.tenant.oid : null
      }
    });
    if (
      publisher &&
      publisher.name === d.input.name &&
      publisher.description === d.input.description &&
      (publisher.source === d.input.source ||
        canonicalize(publisher.source) === canonicalize(d.input.source)) &&
      (publisher.image === d.input.image ||
        canonicalize(publisher.image) === canonicalize(d.input.image))
    ) {
      return publisher;
    }

    return withTransaction(async db => {
      let newId = getId('publisher');

      let publisher = await db.publisher.upsert({
        where: {
          identifier: d.input.identifier,
          tenantOid: d.owner.type === 'tenant' ? d.owner.tenant.oid : null
        },
        create: {
          ...newId,

          tag: await createTag(),

          type: d.owner.type,

          name: d.input.name,
          identifier: d.input.identifier,
          description: d.input.description,
          image: d.input.image,

          source: d.input.source,

          tenantOid: d.owner.type === 'tenant' ? d.owner.tenant.oid : null
        },
        update: {
          name: d.input.name,
          description: d.input.description,
          source: d.input.source
        }
      });

      await addAfterTransactionHook(async () => {
        if (publisher.id === newId.id) {
          await publisherCreatedQueue.add({ publisherId: publisher.id });
        } else {
          await publisherUpdatedQueue.add({ publisherId: publisher.id });
        }
      });

      return publisher;
    });
  }
}

export let publisherInternalService = Service.create(
  'publisherInternalService',
  () => new publisherInternalServiceImpl()
).build();
