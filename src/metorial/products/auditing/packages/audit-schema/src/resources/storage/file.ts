import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let fileAuditResource = resource({
  name: 'file',
  payload: v.typedAny<{
    id: string;
    status: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    title: string | null;
    purposeSlug: string;
    storeId: string;
    isReadOnly: boolean;
    expiresAt: Date | null;
  }>('file'),
  presenter: undefined,
  actions: {
    create: true,
    delete: true
  }
});
