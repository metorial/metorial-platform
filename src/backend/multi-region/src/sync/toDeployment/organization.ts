import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { Organization } from '../../db';

export let syncOrganizationToDeploymentQueue = createQueue<{
  organization: Organization;
}>({
  name: 'global/sync/to-deployment/organization'
});

export let syncOrganizationToDeploymentQueueProcessor =
  syncOrganizationToDeploymentQueue.process(async data => {
    let organization = data.organization;

    await db.cellOrganization.upsert({
      where: { id: organization.id },
      update: {
        status: organization.status,
        type: organization.type,
        slug: organization.slug,
        name: organization.name,
        image: organization.image,
        isOwnedByDeployment: organization.ownerOid === (await cell).oid,
        deletedAt: organization.deletedAt,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
      },
      create: {
        id: organization.id,
        status: organization.status,
        type: organization.type,
        slug: organization.slug,
        name: organization.name,
        image: organization.image,
        isOwnedByDeployment: organization.ownerOid === (await cell).oid,
        deletedAt: organization.deletedAt,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
      }
    });
  });
