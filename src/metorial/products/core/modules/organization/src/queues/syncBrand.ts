import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { db, getImageUrl } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { organizationActorService } from '../services/organizationActor';
import { projectBrandService } from '../services/projectBrand';

export let syncBrandQueue = createQueue<{ projectId: string }>({
  name: 'org/syncBrand'
});

export let syncBrandOrganizationQueue = createQueue<{ organizationId: string }>({
  name: 'org/syncBrand/org'
});

export let syncBrandQueueProcessor = syncBrandQueue.process(async data => {
  let project = await db.project.findUnique({
    where: { id: data.projectId },
    include: { organization: true }
  });
  if (!project) throw new QueueRetryError();
  let brand = await db.projectBrand.findFirst({
    where: { projectOid: project.oid, isDefault: true }
  });

  if (brand && brand.isCustomized) return;

  let actor = await organizationActorService.getSystemActor({
    organization: project.organization
  });

  let orgImage =
    project.organization.image.type === 'default'
      ? { type: 'url' as const, url: await getImageUrl(project.organization) }
      : project.organization.image;

  await projectBrandService.upsertProjectBrand({
    project,
    auditScope: createOrganizationActorAuditScope({
      organization: project.organization,
      organizationActor: actor,
      context: { ip: '0.0.0.0', ua: 'Metorial System' }
    }),
    isAutoUpdate: true,
    input: {
      name: project.name,
      image: orgImage
    }
  });
});

export let syncBrandOrganizationQueueProcessor = syncBrandOrganizationQueue.process(
  async data => {
    let organization = await db.organization.findUnique({
      where: { id: data.organizationId },
      include: { projects: true }
    });
    if (!organization) throw new QueueRetryError();

    await syncBrandQueue.addMany(organization.projects.map(p => ({ projectId: p.id })));
  }
);
