import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

let portalPayload = (portal: FabricEvents['portal.created:after']['portal']) => ({
  id: portal.id,
  status: portal.status,
  name: portal.name,
  slug: portal.slug,
  description: portal.description,
  isDefaultPortal: portal.isDefaultPortal,
  surfaceId: portal.surface.id,
  allowedRedirectUrlFilters:
    portal.allowedRedirectUrlFilters?.map(filter => filter.url) ?? null
});

export let recordPortalCreated = async (event: FabricEvents['portal.created:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'portal', 'create', {
      payload: portalPayload(event.portal),
      recordedAt
    });
  });
};

export let recordPortalUpdated = async (event: FabricEvents['portal.updated:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'portal', 'update', {
      payload: portalPayload(event.portal),
      previousPayload: portalPayload(event.previousPortal),
      recordedAt
    });
  });
};

export let recordPortalArchived = async (event: FabricEvents['portal.archived:after']) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'portal', 'delete', {
      payload: portalPayload(event.portal),
      recordedAt
    });
  });
};

Fabric.listen('portal.created:after', recordPortalCreated);
Fabric.listen('portal.updated:after', recordPortalUpdated);
Fabric.listen('portal.archived:after', recordPortalArchived);
