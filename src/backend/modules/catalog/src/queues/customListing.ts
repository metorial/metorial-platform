import { db, ID } from '@metorial/db';
import { generateCode } from '@metorial/id';
import { profileService } from '@metorial/module-community';
import { createQueue } from '@metorial/queue';
import { createSlugGenerator } from '@metorial/slugify';

let getListingSlug = createSlugGenerator(
  async slug => !(await db.serverListing.findFirst({ where: { slug } }))
);

export let setCustomServerListingQueue = createQueue<{
  serverId: string;
  instanceId: string;
  organizationId: string;
}>({
  name: 'cat/custsrclist'
});

export let setCustomServerListingQueueProcessor = setCustomServerListingQueue.process(
  async data => {
    let server = await db.server.findFirst({
      where: {
        id: data.serverId
      },
      include: {
        customServer: {
          include: {
            instance: {
              include: {
                organization: true
              }
            }
          }
        }
      }
    });
    if (!server || !server.customServer) throw new Error('retry ... not found');

    let existingListing = await db.serverListing.findFirst({
      where: {
        serverOid: server.oid
      }
    });
    if (existingListing?.isCustomized) return; // don't override customized listings

    let profile = await profileService.ensureProfile({
      for: {
        type: 'organization',
        organization: server.customServer.instance.organization
      }
    });

    let listingData = {
      name: server.name,
      description: server.description,
      profileOid: profile?.oid
    };

    await db.serverListing.upsert({
      where: {
        serverOid: server.oid
      },
      create: {
        id: await ID.generateId('serverListing'),
        serverOid: server.oid,
        ownerOrganizationOid: server.customServer.instance.organization.oid,
        status: 'active',
        isCustomized: false,
        isPublic: false,
        slug: await getListingSlug({ input: `${server.name}-${generateCode(5)}` }),
        ...listingData
      },
      update: listingData
    });
  }
);
