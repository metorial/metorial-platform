import { canonicalize } from '@metorial/canonicalize';
import { createCron } from '@metorial/cron';
import {
  db,
  ensureImportedRepository,
  ensureImportedServer,
  ensureImportedServerVendor,
  ensureServerConfig,
  ensureServerListing,
  ensureServerListingCategory,
  ensureServerVariant,
  ensureServerVariantProvider,
  ensureServerVersion,
  ID,
  ServerVersion
} from '@metorial/db';
import { debug } from '@metorial/debug';
import { Hash } from '@metorial/hash';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { Database } from 'bun:sqlite';
import path from 'path';
import { indexServerListingQueue } from './search';

let syncCron = createCron(
  {
    name: 'cat/sync/cron',
    cron: '0 0 * * *'
  },
  async () => {
    await startSyncQueue.add({});
  }
);

let startSyncQueue = createQueue({
  name: 'cat/sync/start',
  workerOpts: {
    limiter: {
      max: 1,
      duration: process.env.NODE_ENV == 'development' ? 1000 * 60 * 60 * 12 : 1000 * 60 * 5
    }
  }
});

startSyncQueue.add({}).catch(e => console.error('Error adding to full sync queue', e));

let fullSyncQueue = createQueue({
  name: 'cat/sync/full'
});

let vendorsSyncQueue = createQueue({
  name: 'cat/sync/vendors'
});

let categoriesSyncQueue = createQueue({
  name: 'cat/sync/categories'
});

let providersSyncQueue = createQueue({
  name: 'cat/sync/provider'
});

let repositoriesSyncQueue = createQueue({
  name: 'cat/sync/repositories'
});

let serversSyncQueue = createQueue({
  name: 'cat/sync/servers'
});

let serverSyncQueue = createQueue<{ identifier: string }>({
  name: 'cat/sync/server',
  workerOpts: {
    concurrency: 1,

    limiter:
      process.env.NODE_ENV == 'development'
        ? undefined
        : {
            max: 20,
            duration: 1000
          }
  },
  jobOpts: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

let getIndexDatabase = () =>
  new Database(path.join(__dirname, '../index.db'), { readonly: true });

let startSyncQueueProcessor = startSyncQueue.process(async () => {
  debug.log('Starting full sync...');

  await fullSyncQueue.add({});
});

let fullSyncQueueProcessor = fullSyncQueue.process(async () => {
  debug.log('Running full sync...');

  await vendorsSyncQueue.add({});
});

let vendorsSyncQueueProcessor = vendorsSyncQueue.process(async () => {
  debug.log('Syncing vendors...');

  let index = getIndexDatabase();

  let vendors = index
    .query<
      {
        identifier: string;
        name: string;
        description: string;
        imageUrl: string;
        websiteUrl: string;
      },
      any
    >('SELECT * FROM PublicServerVendor')
    .iterate();

  for (let vendor of vendors) {
    await ensureImportedServerVendor(() => ({
      identifier: vendor.identifier,
      name: vendor.name,
      description: vendor.description,
      image: { type: 'url', url: vendor.imageUrl },
      attributes: { websiteUrl: vendor.websiteUrl }
    }));
  }

  debug.log('Vendors synced');

  await categoriesSyncQueue.add({});
});

let categoriesSyncQueueProcessor = categoriesSyncQueue.process(async () => {
  debug.log('Syncing categories...');

  let index = getIndexDatabase();

  let categories = index
    .query<
      {
        identifier: string;
        name: string;
        description: string;
      },
      any
    >('SELECT * FROM PublicServerCategory')
    .iterate();

  for (let category of categories) {
    await ensureServerListingCategory(() => ({
      slug: category.identifier,
      name: category.name,
      description: category.description
    }));
  }

  debug.log('Categories synced');

  await providersSyncQueue.add({});
});

let providersSyncQueueProcessor = providersSyncQueue.process(async () => {
  debug.log('Syncing providers...');

  let index = getIndexDatabase();

  let providers = index
    .query<
      {
        identifier: string;
        name: string;
        description: string;
        websiteUrl: string;
        imageUrl: string;
      },
      any
    >('SELECT * FROM PublicServerProvider')
    .iterate();

  for (let provider of providers) {
    await ensureServerVariantProvider(() => ({
      identifier: provider.identifier,
      name: provider.name,
      description: provider.description,
      image: { type: 'url', url: provider.imageUrl },
      attributes: { websiteUrl: provider.websiteUrl }
    }));
  }

  debug.log('Providers synced');

  await repositoriesSyncQueue.add({});
});

let repositoriesSyncQueueProcessor = repositoriesSyncQueue.process(async () => {
  debug.log('Syncing repositories...');

  let index = getIndexDatabase();

  let repositories = index
    .query<
      {
        identifier: string;
        slug: string;
        name: string;
        providerUrl: string;
        websiteUrl: string;
        provider: string;
        providerId: string;
        providerFullIdentifier: string;
        providerIdentifier: string;
        providerOwnerId: string;
        providerOwnerIdentifier: string;
        providerOwnerUrl: string;
        isFork: number;
        isArchived: number;
        starCount: number;
        forkCount: number;
        watcherCount: number;
        openIssuesCount: number;
        subscriptionCount: number;
        size: number;
        defaultBranch: string;
        licenseName: string;
        licenseUrl: string;
        licenseSpdxId: string;
        topics: string[];
        language: string;
        description: string;
        createdAt: string;
        updatedAt: string;
        pushedAt: string;
      },
      any
    >('SELECT * FROM PublicRepository')
    .iterate();

  for (let repository of repositories) {
    await ensureImportedRepository(() => ({
      identifier: repository.identifier,
      slug: repository.slug,
      name: repository.name,
      providerUrl: repository.providerUrl,
      websiteUrl: repository.websiteUrl,
      provider: repository.provider,
      providerId: repository.providerId,
      providerFullIdentifier: repository.providerFullIdentifier,
      providerIdentifier: repository.providerIdentifier,
      providerOwnerId: repository.providerOwnerId,
      providerOwnerIdentifier: repository.providerOwnerIdentifier,
      providerOwnerUrl: repository.providerOwnerUrl,
      isFork: Boolean(repository.isFork),
      isArchived: Boolean(repository.isArchived),
      starCount: repository.starCount,
      forkCount: repository.forkCount,
      watcherCount: repository.watcherCount,
      openIssuesCount: repository.openIssuesCount,
      subscriptionCount: repository.subscriptionCount,
      size: repository.size,
      defaultBranch: repository.defaultBranch,
      licenseName: repository.licenseName,
      licenseUrl: repository.licenseUrl,
      licenseSpdxId: repository.licenseSpdxId,
      topics: repository.topics,
      pushedAt: new Date(repository.pushedAt),
      createdAt: new Date(repository.createdAt),
      updatedAt: new Date(repository.updatedAt)
    }));
  }

  console.log('Repositories synced');

  await serversSyncQueue.add({});
});

let serversSyncQueueProcessor = serversSyncQueue.process(async () => {
  debug.log('Syncing servers...');

  let index = getIndexDatabase();

  let servers = index
    .query<{ identifier: string }, any>('SELECT * FROM PublicServer')
    .iterate();

  let chunk: string[] = [];
  let maxChunkSize = 100;

  for (let server of servers) {
    chunk.push(server.identifier);

    if (chunk.length >= maxChunkSize) {
      await serverSyncQueue.addManyWithOps(
        chunk.map(identifier => ({ data: { identifier }, opts: { id: identifier } }))
      );
      chunk = [];
    }
  }

  if (chunk.length > 0) {
    await serverSyncQueue.addManyWithOps(
      chunk.map(identifier => ({ data: { identifier }, opts: { id: identifier } }))
    );
  }
});

let serverSyncQueueProcessor = serverSyncQueue.process(async ({ identifier }) => {
  debug.log(`Syncing server ${identifier}...`);

  try {
    let index = getIndexDatabase();

    let server = index
      .query<
        {
          identifier: string;
          fullSlug: string;
          slug: string;
          name: string;
          description: string;
          subdirectory: string;
          websiteUrl: string;
          isOfficial: number;
          isCommunity: number;
          isHostable: number;
          readme: string;
          vendorIdentifier: string;
          repositoryIdentifier: string;
          skills: string[];
        },
        any
      >('SELECT * FROM PublicServer WHERE identifier = ?')
      .get(identifier);

    let categoryIdentifiers = index
      .query<
        {
          B: string;
        },
        any
      >('SELECT * FROM _PublicServerToPublicServerCategory WHERE A = ?')
      .all(identifier);

    let variants = index
      .query<
        {
          identifier: string;
          sourceType: 'docker' | 'remote';
          providerIdentifier: string;
          dockerImage: string | null;
          remoteUrl: string | null;
        },
        any
      >('SELECT * FROM PublicServerVariant WHERE serverIdentifier = ?')
      .all(identifier);

    if (!server) return;

    let vendor = await db.importedServerVendor.findUniqueOrThrow({
      where: { identifier: server.vendorIdentifier }
    });

    let repository = await db.importedRepository.findUniqueOrThrow({
      where: { identifier: server.repositoryIdentifier }
    });

    let existingImportedServer = await db.importedServer.findUnique({
      where: { identifier: server.identifier },
      include: { server: true }
    });

    let baseServer =
      existingImportedServer?.server ??
      (await db.server.create({
        data: {
          id: await ID.generateId('server'),
          type: 'imported',
          name: server.name
        }
      }));

    let ourServer = await ensureImportedServer(() => ({
      vendorOid: vendor.oid,
      repositoryOid: repository.oid,
      serverOid: baseServer.oid,

      identifier: server.identifier,
      fullSlug: server.fullSlug,
      slug: server.slug,

      name: server.name,
      description: server.description,

      subdirectory: server.subdirectory,

      isOfficial: Boolean(server.isOfficial),
      isCommunity: Boolean(server.isCommunity),
      isHostable: Boolean(server.isHostable),

      readme: server.readme,

      attributes: { websiteUrl: server.websiteUrl }
    }));

    let existingListing = await db.serverListing.findUnique({
      where: { serverOid: baseServer.oid }
    });

    let serverListing = await ensureServerListing(() => ({
      status: existingListing?.status ?? 'active',
      name: server.name,
      slug: existingListing?.slug ?? `${vendor.identifier}/${ourServer.slug}`,
      description: server.description,
      readme: server.readme,
      serverOid: baseServer.oid,
      skills: server.skills || [],

      categories: {
        connect: categoryIdentifiers.map(categoryIdentifier => ({
          slug: categoryIdentifier.B
        }))
      }
    }));

    // Only create variants if the server is hostable
    if (ourServer.isHostable) {
      for (let variant of variants) {
        let versions = index
          .query<
            {
              identifier: string;
              sourceType: 'docker' | 'remote';
              dockerImage: string | null;
              dockerTag: string | null;
              remoteUrl: string | null;
              config: any;
              getLaunchParams: string;
              createdAt: string;
            },
            any
          >('SELECT * FROM PublicServerVariantVersion WHERE variantIdentifier = ?')
          .all(variant.identifier);

        let provider = await db.serverVariantProvider.findUniqueOrThrow({
          where: { identifier: variant.providerIdentifier }
        });

        let ourVariant = await ensureServerVariant(() => ({
          identifier: variant.identifier,

          serverOid: baseServer.oid,
          providerOid: provider.oid,

          sourceType: variant.sourceType,
          dockerImage: variant.dockerImage,
          remoteUrl: variant.remoteUrl
        }));

        let currentVersion: null | ServerVersion = null;

        for (let version of versions) {
          let schema = await ensureServerConfig(async () => ({
            fingerprint: await Hash.sha256(canonicalize(version.config)),
            schema: version.config,
            serverOid: baseServer.oid,
            serverVariantOid: ourVariant.oid
          }));

          let ourVersion = await ensureServerVersion(() => ({
            identifier: version.identifier,

            schemaOid: schema.oid,
            serverOid: baseServer.oid,
            serverVariantOid: ourVariant.oid,

            sourceType: version.sourceType,
            dockerImage: version.dockerImage,
            remoteUrl: version.remoteUrl,

            getLaunchParams: version.getLaunchParams,

            createdAt: new Date(version.createdAt)
          }));

          if (
            !currentVersion ||
            currentVersion.createdAt.getTime() < ourVersion.createdAt.getTime()
          ) {
            currentVersion = ourVersion;
          }
        }

        await db.serverVariant.update({
          where: { oid: ourVariant.oid },
          data: { currentVersionOid: currentVersion?.oid ?? null }
        });
      }
    }

    await indexServerListingQueue.add({
      serverListingId: serverListing.id
    });
  } catch (e) {}
});

export let syncProcessors = combineQueueProcessors([
  syncCron,
  startSyncQueueProcessor,
  fullSyncQueueProcessor,
  vendorsSyncQueueProcessor,
  categoriesSyncQueueProcessor,
  providersSyncQueueProcessor,
  repositoriesSyncQueueProcessor,
  serversSyncQueueProcessor,
  serverSyncQueueProcessor
]);
