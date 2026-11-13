import { db } from '@mtsrc/agent-tracking-db';
import { Events } from '@mtsrc/agent-tracking-events';
import { priceOverrideRebuildReason } from '@mtsrc/agent-tracking-layers';
import { startImpactRebuild } from './queues/rebuild';
import { startCatalogRebuild } from './lib/triggers';

Events.listen('knowledge.catalog.changed:after', d => startCatalogRebuild(d));

Events.listen('knowledge.price_override.changed:after', async d => {
  let organization = await db.organization.findUnique({ where: { id: d.organizationId } });
  if (!organization || organization.archivedAt) return;

  let project = d.projectId
    ? await db.project.findUnique({ where: { id: d.projectId } })
    : null;

  await startImpactRebuild({
    organization,
    project,
    impacts: d.impacts,
    reason: priceOverrideRebuildReason
  });
});
