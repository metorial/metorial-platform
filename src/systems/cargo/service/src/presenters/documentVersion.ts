import type {
  Document,
  DocumentContent,
  DocumentVersion,
  DocumentVersionEditors,
  TenantActor
} from '@metorial-cargo/db';
import { actorPresenter } from './actor';

export let documentVersionPresenter = (
  version: DocumentVersion & {
    document: Document;
    previousVersion: DocumentVersion | null;
    content: DocumentContent;
    documentVersionEditors: Array<
      DocumentVersionEditors & {
        tenantActor: TenantActor;
      }
    >;
  }
) => ({
  object: 'cargo#documentVersion',
  id: version.id,
  documentId: version.document.id,
  versionNumber: version.versionNumber,
  previousVersionId: version.previousVersion?.id,
  listEditedAt: version.listEditedAt,
  content: version.content.content,
  editors: version.documentVersionEditors.map(editor => actorPresenter(editor.tenantActor)),
  createdAt: version.createdAt
});
