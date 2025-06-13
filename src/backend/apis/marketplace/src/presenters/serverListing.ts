import {
  ImportedRepository,
  ImportedServer,
  ImportedServerVendor,
  Instance,
  InstanceServer,
  Server,
  ServerListing,
  ServerListingCategory
} from '@metorial/db';
import { repositoryPresenter } from './repository';
import { serverCategoryPresenter } from './serverCategory';
import { vendorPresenter } from './vendor';

export let serverListingPresenter = async (
  serverListing: Omit<ServerListing, 'readme'> & {
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
    // readme: serverListing.readme,

    skills: serverListing.skills,

    serverId: serverListing.server.id,

    categories: serverListing.categories.map(category => serverCategoryPresenter(category)),

    isOfficial: !!serverListing.server.importedServer?.isOfficial,
    isCommunity: !!serverListing.server.importedServer?.isCommunity,
    isHostable: !!serverListing.server.importedServer?.isHostable,

    subdirectory: serverListing.server.importedServer?.subdirectory,

    vendor: vendor ? await vendorPresenter(vendor) : null,
    repository: repository ? await repositoryPresenter(repository) : null,

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
