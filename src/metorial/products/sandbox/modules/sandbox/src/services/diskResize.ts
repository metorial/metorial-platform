import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  sandboxDiskInternalService,
  type SandboxDiskWithTenant
} from '../internal/diskInternal';
import { getRegional } from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';

class SandboxDiskResizeServiceImpl {
  async start(d: {
    disk: SandboxDiskWithTenant;
    input: { sizeBytes: string; idempotencyKey: string };
  }) {
    sandboxDiskInternalService.assertActive(d.disk);

    let { genesis, tenantId } = getRegional(d.disk.tenant);

    return await genesis.disk.resize({ tenantId, diskId: d.disk.id, ...d.input });
  }

  async get(d: { disk: SandboxDiskWithTenant; resizeId: string }) {
    let { genesis, tenantId } = getRegional(d.disk.tenant);

    let resize = await genesis.disk.resizeGet({ tenantId, resizeId: d.resizeId });
    if (resize.diskId != d.disk.id) {
      throw new ServiceError(notFoundError('sandbox_disk_resize', d.resizeId));
    }

    return resize;
  }

  list(d: { disk: SandboxDiskWithTenant }) {
    let { genesis, tenantId } = getRegional(d.disk.tenant);

    return createRemotePaginator(
      page => genesis.disk.resizeList({ tenantId, diskId: d.disk.id, ...page }),
      { defaultOrder: 'desc' }
    );
  }

  async retry(d: { disk: SandboxDiskWithTenant; resizeId: string }) {
    sandboxDiskInternalService.assertActive(d.disk);
    await this.get(d);

    let { genesis, tenantId } = getRegional(d.disk.tenant);

    return await genesis.disk.resizeRetry({ tenantId, resizeId: d.resizeId });
  }
}

export let sandboxDiskResizeService = Service.create(
  'sandboxDiskResizeService',
  () => new SandboxDiskResizeServiceImpl()
).build();
