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
import { Hash } from '@metorial/hash';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { startRankQueue } from '../rank';
import { indexServerListingQueue } from '../search';
import { IndexDB } from './indexDb';

let syncCron = createCron(
  {
    name: 'cat/sync/cron',
    cron: '0 * * * *'
  },
  async () => {
    await syncQueue.add({}, { id: 'init' });
  }
);

let syncQueue = createQueue({
  name: 'cat/sync',
  workerOpts: {
    concurrency: 1,
    limiter: {
      max: 1,
      duration: process.env.METORIAL_ENV == 'development' ? 1000 * 60 * 60 : 1000 * 60 * 60 * 6
    }
  }
});

syncQueue
  .add({}, { id: 'init' })
  .catch(e => console.error('Error adding to full sync queue', e));

export let syncProcessor = syncQueue.process(async () => {
  await IndexDB.createAndUse(async index => {
    for (let vendor of index.vendors.iterate()) {
      await ensureImportedServerVendor(() => ({
        identifier: vendor.identifier,
        name: vendor.name,
        description: vendor.description,
        image: { type: 'url', url: vendor.imageUrl },
        attributes: { websiteUrl: vendor.websiteUrl }
      }));
    }

    for (let category of index.categories.iterate()) {
      await ensureServerListingCategory(() => ({
        slug: category.identifier,
        name: category.name,
        description: category.description
      }));
    }

    for (let provider of index.serverProviders.iterate()) {
      await ensureServerVariantProvider(() => ({
        identifier: provider.identifier,
        name: provider.name,
        description: provider.description,
        image: { type: 'url', url: provider.imageUrl },
        attributes: { websiteUrl: provider.websiteUrl }
      }));
    }

    for (let repository of index.repositories.iterate()) {
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

    for (let server of index.servers.iterate()) {
      try {
        let categoryIdentifiers = index.servers.categoryIdentifiers(server);
        let variants = index.servers.variants(server);

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
          isHostable: Boolean(server.isHostable) && variants.length > 0,

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
          skills: JSON.parse(server.skills),

          categories: {
            connect: categoryIdentifiers.map(categoryIdentifier => ({
              slug: categoryIdentifier.B
            }))
          }
        }));

        if (ourServer.isHostable) {
          for (let variant of variants) {
            let versions = index.serverVariants.versions(variant);

            let provider = await db.serverVariantProvider.findUniqueOrThrow({
              where: { identifier: variant.providerIdentifier }
            });

            let ourVariant = await ensureServerVariant(() => ({
              identifier: variant.identifier,

              serverOid: baseServer.oid,
              providerOid: provider.oid,

              sourceType: variant.sourceType,
              dockerImage: variant.dockerImage,
              remoteUrl: variant.remoteUrl,

              tools: server.tools ? JSON.parse(server.tools) : undefined
            }));

            let currentVersion: null | ServerVersion = null;

            for (let version of versions) {
              let schema = await ensureServerConfig(async () => ({
                fingerprint: await Hash.sha256(canonicalize(version.config)),
                schema: version.config,
                serverOid: baseServer.oid,
                serverVariantOid: ourVariant.oid
              }));

              let ourVersion = await ensureServerVersion(
                () => ({
                  identifier: version.identifier,

                  schemaOid: schema.oid,
                  serverOid: baseServer.oid,
                  serverVariantOid: ourVariant.oid,

                  sourceType: version.sourceType,
                  dockerImage: version.dockerImage,
                  remoteUrl: version.remoteUrl,

                  tools: ourVariant.tools,

                  getLaunchParams: version.getLaunchParams,

                  createdAt: new Date(version.createdAt)
                }),
                { ignoreForUpdate: ['tools'] }
              );

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

        await indexServerListingQueue.add(
          { serverListingId: serverListing.id },
          { id: serverListing.id }
        );
      } catch (e) {
        // Ignore and continue with other servers
      }
    }

    await startRankQueue.add({}, { id: 'rank' });
  });
});

export let syncProcessors = combineQueueProcessors([syncCron, syncProcessor]);
