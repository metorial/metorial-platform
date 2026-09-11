import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let documentAuditResource = resource({
  name: 'document',
  payload: v.typedAny<{
    id: string;
    title: string;
    fileId: string;
    parentDocumentId: string | null;
    isReadOnly: boolean;
    currentVersionId: string | null;
    byteSize: number;
  }>('document'),
  presenter: undefined,
  actions: {
    create: true,
    delete: true,
    edit: {
      validationType: v.typedAny<{
        id: string;
        title: string;
        versionId: string;
        versionNumber: number;
        previousVersionId: string | null;
        byteSize: number;
        editedAt: Date;
      }>('document.edit')
    }
  }
});
