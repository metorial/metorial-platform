import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let sandboxDiskAuditResource = resource({
  name: 'sandbox_disk',
  payload: v.typedAny<{
    id: string;
    name: string | null;
    type: string;
    sizeBytes: number | null;
    regionIdentifier: string | null;
    sourceDiskId?: string | null;
    sourceImageId?: string | null;
  }>('sandbox_disk'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let sandboxDiskResizeAuditResource = resource({
  name: 'sandbox_disk_resize',
  payload: v.typedAny<{
    resizeId: string;
    diskId: string;
    diskName: string | null;
    sizeBytes: number | null;
  }>('sandbox_disk_resize'),
  presenter: undefined,
  actions: {
    create: true,
    retry: true
  }
});
