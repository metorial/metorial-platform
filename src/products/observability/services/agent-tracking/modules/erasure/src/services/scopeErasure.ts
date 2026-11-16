import { Service } from '@lowerdeck/service';
import type { Instance, Organization, Project } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { eraseEntitiesQueue } from '@mtsrc/agent-tracking-module-entities';
import { recordErasureService } from '@mtsrc/agent-tracking-module-records';

class ScopeErasureServiceImpl {
  async eraseOrganization(d: { organization: Organization }) {
    let instances = await db.instance.findMany({
      where: { organizationOid: d.organization.oid },
      select: { id: true }
    });

    await recordErasureService.eraseScope({
      scope: { organizationId: d.organization.id },
      instanceIds: instances.map(instance => instance.id)
    });
    await eraseEntitiesQueue.add({ organizationId: d.organization.id });
  }

  async eraseProject(d: { organization: Organization; project: Project }) {
    let instances = await db.instance.findMany({
      where: { projectOid: d.project.oid },
      select: { id: true }
    });

    await recordErasureService.eraseScope({
      scope: { organizationId: d.organization.id, projectId: d.project.id },
      instanceIds: instances.map(instance => instance.id)
    });
    await eraseEntitiesQueue.add({
      organizationId: d.organization.id,
      projectId: d.project.id
    });
  }

  async eraseInstance(d: { organization: Organization; instance: Instance }) {
    await recordErasureService.eraseScope({
      scope: { organizationId: d.organization.id, instanceId: d.instance.id },
      instanceIds: [d.instance.id]
    });
    await eraseEntitiesQueue.add({
      organizationId: d.organization.id,
      instanceId: d.instance.id
    });
  }
}

export let scopeErasureService = Service.create(
  'scopeErasureService',
  () => new ScopeErasureServiceImpl()
).build();
