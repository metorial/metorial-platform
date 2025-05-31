import {
  getImageUrl,
  ImportedRepository,
  ImportedServer,
  ImportedServerVendor,
  Instance,
  InstanceServer,
  Server,
  ServerListing,
  ServerListingCategory
} from '@metorial/db';
import { serverCategoryPresenter } from './serverCategory';

export let serverListingPresenter = async (
  serverListing: ServerListing & {
    categories: ServerListingCategory[];
    server: Server & {
      importedServer:
        | (ImportedServer & {
            vendor: ImportedServerVendor;
            repository: ImportedRepository | null;
          })
        | null;

      instanceServers?: (InstanceServer & { instance: Instance })[];
    };
  }
) => {
  let vendor = serverListing.server.importedServer?.vendor;
  let repository = serverListing.server.importedServer?.repository;

  return {
    object: 'marketplace*server_listing',

    id: serverListing.id,
    status: serverListing.status,

    slug: serverListing.slug,
    name: serverListing.name,
    description: serverListing.description,
    readme: serverListing.readme,

    serverId: serverListing.server.id,

    categories: serverListing.categories.map(category => serverCategoryPresenter(category)),

    isOfficial: !!serverListing.server.importedServer?.isOfficial,
    isCommunity: !!serverListing.server.importedServer?.isCommunity,
    isHostable: !!serverListing.server.importedServer?.isHostable,

    vendor: vendor
      ? {
          id: vendor.id,
          identifier: vendor.identifier,
          name: vendor.name,
          description: vendor.description,

          imageUrl: await getImageUrl(vendor),

          attributes: vendor.attributes,

          createdAt: vendor.createdAt,
          updatedAt: vendor.updatedAt
        }
      : null,

    repository: repository
      ? {
          id: repository.id,
          identifier: repository.identifier,
          slug: repository.slug,
          name: repository.name,
          providerUrl: repository.providerUrl,
          websiteUrl: repository.websiteUrl,
          provider: repository.provider,

          starCount: repository.starCount,
          forkCount: repository.forkCount,
          watcherCount: repository.watcherCount,
          openIssuesCount: repository.openIssuesCount,
          subscriptionCount: repository.subscriptionCount,

          defaultBranch: repository.defaultBranch,

          licenseName: repository.licenseName,
          licenseUrl: repository.licenseUrl,
          licenseSpdxId: repository.licenseSpdxId,

          topics: repository.topics,

          language: repository.language,
          description: repository.description,

          createdAt: repository.createdAt,
          updatedAt: repository.updatedAt,
          pushedAt: repository.pushedAt
        }
      : null,

    installation: serverListing.server.instanceServers?.length
      ? {
          id: serverListing.server.instanceServers[0].id,
          createdAt: serverListing.server.instanceServers[0].createdAt,
          instanceId: serverListing.server.instanceServers[0].instance.id
        }
      : null,

    createdAt: serverListing.createdAt,
    updatedAt: serverListing.updatedAt
  };
};
