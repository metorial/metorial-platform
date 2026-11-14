import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Fabric } from '@metorial/fabric';
import {
  sandboxDiskInternalService,
  type SandboxDiskWithTenant
} from '../internal/diskInternal';
import { toAuditDisk } from '../lib/audit';
import { getRegional, type SandboxDiskResizeFilter } from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';

class SandboxDiskResizeServiceImpl {
  async start(d: {
    disk: SandboxDiskWithTenant;
    auditScope: AuditScope;
    input: { sizeBytes: string; idempotencyKey: string };
  }) {
    sandboxDiskInternalService.assertActive(d.disk);

    let { genesis, tenantId } = getRegional(d.disk.tenant);

    let resize = await genesis.disk.resize({ tenantId, diskId: d.disk.id, ...d.input });
    await Fabric.fire('sandbox.disk.resized:after', {
      auditScope: d.auditScope,
      disk: toAuditDisk(d.disk),
      resizeId: resize.id,
      sizeBytes: Number(d.input.sizeBytes),
      retry: false
    });

    return resize;
  }

  async get(d: { disk: SandboxDiskWithTenant; resizeId: string }) {
    let { genesis, tenantId } = getRegional(d.disk.tenant);

    let resize = await genesis.disk.resizeGet({ tenantId, resizeId: d.resizeId });
    if (resize.diskId != d.disk.id) {
      throw new ServiceError(notFoundError('sandbox_disk_resize', d.resizeId));
    }

    return resize;
  }

  list(d: { disk: SandboxDiskWithTenant; statuses?: SandboxDiskResizeFilter['statuses'] }) {
    let { genesis, tenantId } = getRegional(d.disk.tenant);

    return createRemotePaginator(
      page =>
        genesis.disk.resizeList({
          tenantId,
          diskId: d.disk.id,
          statuses: d.statuses,
          ...page
        }),
      { defaultOrder: 'desc' }
    );
  }

  async retry(d: { disk: SandboxDiskWithTenant; auditScope: AuditScope; resizeId: string }) {
    sandboxDiskInternalService.assertActive(d.disk);
    await this.get(d);

    let { genesis, tenantId } = getRegional(d.disk.tenant);

    let resize = await genesis.disk.resizeRetry({ tenantId, resizeId: d.resizeId });
    await Fabric.fire('sandbox.disk.resized:after', {
      auditScope: d.auditScope,
      disk: toAuditDisk(d.disk),
      resizeId: d.resizeId,
      sizeBytes: null,
      retry: true
    });

    return resize;
  }
}

export let sandboxDiskResizeService = Service.create(
  'sandboxDiskResizeService',
  () => new SandboxDiskResizeServiceImpl()
).build();
