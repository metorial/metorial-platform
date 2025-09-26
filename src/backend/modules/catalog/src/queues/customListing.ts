import { db, ID } from '@metorial/db';
import { generateCode } from '@metorial/id';
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
      }
    });
    if (!server) throw new Error('retry ... not found');

    let listingData = {
      name: server.name,
      description: server.description
    };

    await db.serverListing.upsert({
      where: {
        serverOid: server.oid
      },
      create: {
        id: await ID.generateId('serverListing'),
        serverOid: server.oid,
        status: 'active',
        slug: await getListingSlug({ input: `${server.name}-${generateCode(5)}` }),
        ...listingData
      },
      update: listingData
    });
  }
);
