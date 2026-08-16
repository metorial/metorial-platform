import { Service } from '@lowerdeck/service';
import type { CargoScope } from '@metorial/cargo-list-utils';
import type { ResourceAuthorization } from '@metorial/module-access';
import { internalDocumentCollaborationService } from '../internal/documentCollaboration';
import { publishDocumentLiveBusMessage } from '../live/documentLiveBus';
import { flushDocumentDraft } from '../queues/documentFlush';
import { documentService, type ResolvedDocumentRecord } from './document';

class DocumentAuthoritativeWriteService {
  async applyDocumentContent(
    d: CargoScope & {
      document: ResolvedDocumentRecord;
      input: {
        title: string;
        content: string;
        authorization: ResourceAuthorization;
      };
    }
  ) {
    let collaboration = await internalDocumentCollaborationService.withDocumentLock(
      d.document.id,
      async () => {
        await documentService.updateDocument({
          project: d.project,
          instance: d.instance,
          document: d.document,
          input: d.input
        });
        await flushDocumentDraft({
          documentId: d.document.id,
          force: true
        });

        try {
          return await internalDocumentCollaborationService.replaceStateWhileLocked({
            documentId: d.document.id,
            update: null
          });
        } catch (error) {
          await internalDocumentCollaborationService.clearState(d.document.id);
          throw error;
        }
      }
    );

    await publishDocumentLiveBusMessage({
      deliverToOriginInstance: true,
      documentId: d.document.id,
      type: 'collaboration_reset',
      data: {
        stateUpdate: collaboration.update,
        generation: collaboration.generation
      }
    });

    return await documentService.getDocumentById({
      project: d.project,
      instance: d.instance,
      documentId: d.document.id,
      authorization: d.input.authorization
    });
  }
}

export let documentAuthoritativeWriteService = Service.create(
  'cargoDocumentAuthoritativeWriteService',
  () => new DocumentAuthoritativeWriteService()
).build();
