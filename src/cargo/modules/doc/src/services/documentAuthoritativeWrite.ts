import { Service } from '@lowerdeck/service';
import type { CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { internalDocumentCollaborationService } from '../internal/documentCollaboration';
import { publishDocumentLiveBusMessage } from '../live/documentLiveBus';
import { flushDocumentDraft } from '../queues/documentFlush';
import { documentService, type ResolvedDocumentRecord } from './document';

class DocumentAuthoritativeWriteService {
  async applyDocumentContent(
    d: CargoTenantEnvironment & {
      document: ResolvedDocumentRecord;
      input: {
        title: string;
        content: string;
        actorId?: string;
      };
    }
  ) {
    let collaboration = await internalDocumentCollaborationService.withDocumentLock(
      d.document.id,
      async () => {
        await documentService.updateDocument({
          tenant: d.tenant,
          environment: d.environment,
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
      tenant: d.tenant,
      environment: d.environment,
      documentId: d.document.id,
      actorId: d.input.actorId
    });
  }
}

export let documentAuthoritativeWriteService = Service.create(
  'cargoDocumentAuthoritativeWriteService',
  () => new DocumentAuthoritativeWriteService()
).build();
