import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import {
  createCollectionsRegistryClient,
  createRootRegistryClient
} from '@metorial-services/registry-client';
import { db } from '@metorial-subspace/db';
import { providerListingCollectionService } from '@metorial-subspace/module-catalog';
import { env } from '../../env';

let registryClient = env.service.REGISTRY_URL
  ? createRootRegistryClient({
      endpoint: env.service.REGISTRY_URL
    })
  : null;

export let syncCollectionsCron = createCron(
  {
    name: 'sub/slt/sync/collections/cron',
    redisUrl: env.service.REDIS_URL,
    cron: process.env.NODE_ENV == 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    if (!registryClient) return;

    let registries = await registryClient.registry.list({});
    let collectionsRegistries = registries.filter(r => r.from.type === 'collections');

    await syncCollectionsReg.addMany(
      collectionsRegistries.map(r => ({
        registryUrl: r.from.url
      }))
    );
  }
);

let syncCollectionsReg = createQueue<{
  registryUrl: string;
}>({
  name: 'sub/slt/sync/collections/reg',
  redisUrl: env.service.REDIS_URL
});

export let syncCollectionsRegProcessor = syncCollectionsReg.process(async data => {
  let client = createCollectionsRegistryClient({
    endpoint: data.registryUrl
  });

  let cursor: string | undefined;
  while (true) {
    let collections = await client.collection.list({
      limit: 100,
      after: cursor
    });
    if (!collections.items.length) break;

    for (let collection of collections.items) {
      await providerListingCollectionService.upsertProviderListingCollection({
        input: {
          name: collection.name,
          description: collection.description ?? '',
          slug: collection.identifier
        }
      });
    }

    cursor = collections.items[collections.items.length - 1]!.id as string;
  }

  await syncCollectionsMany.add({
    registryUrl: data.registryUrl
  });
});

let syncCollectionsMany = createQueue<{
  registryUrl: string;
  cursor?: string;
}>({
  name: 'sub/slt/sync/collections/many',
  redisUrl: env.service.REDIS_URL
});

export let syncCollectionsManyProcessor = syncCollectionsMany.process(async data => {
  let client = createCollectionsRegistryClient({
    endpoint: data.registryUrl
  });

  let slates = await client.slate.list({
    after: data.cursor,
    limit: 100
  });
  if (!slates.items.length) return;

  let collections = await db.providerListingCollection.findMany({});
  let collectionsMap = new Map(collections.map(c => [c.slug, c.id]));

  await syncCollectionsSingle.addMany(
    slates.items.map(s => ({
      identifier: s.identifier,
      collections: s.collections.map(c => collectionsMap.get(c.identifier)!).filter(Boolean)
    }))
  );

  await syncCollectionsMany.add({
    registryUrl: data.registryUrl,
    cursor: slates.items[slates.items.length - 1]!.id as string
  });
});

let syncCollectionsSingle = createQueue<{
  identifier: string;
  collections: string[];
}>({
  name: 'sub/slt/sync/collections/sing',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 10,
      duration: 1000
    }
  }
});

export let syncCollectionsSingleProcessor = syncCollectionsSingle.process(async data => {
  let slate = await db.slate.findFirst({
    where: { identifierInRegistry: data.identifier },
    include: { providerVariants: { include: { provider: { include: { listing: true } } } } }
  });
  let listing = slate?.providerVariants[0]?.provider.listing;
  if (!listing) return;

  await db.providerListing.update({
    where: { id: listing.id },
    data: {
      collections: {
        set: data.collections.map(c => ({ id: c }))
      }
    }
  });
});
