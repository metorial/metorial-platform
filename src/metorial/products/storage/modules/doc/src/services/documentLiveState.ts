import { conflictError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  applyCommentAnchorToYjsUpdate,
  removeCommentAnchorFromYjsUpdate,
  type DocumentCommentAnchor
} from '@metorial/docs-editor-schema';
import { internalDocumentCollaborationService } from '../internal/documentCollaboration';
import { buildLiveStateFromStoredBody } from '../lib/documentBody';
import { publishDocumentLiveBusMessage } from '../live/documentLiveBus';
import { queueDocumentCollaborationFlush } from '../queues/documentCollaborationFlush';
import { documentService } from './document';

class DocumentLiveStateServiceImpl {
  private async buildLiveState(documentId: string) {
    let { document } = await documentService.getScopedDocumentById({ documentId });

    return buildLiveStateFromStoredBody({
      title: document.resolvedTitle ?? document.title,
      content: document.resolvedContent ?? document.content.content,
      annotations: document.hasDraft
        ? document.resolvedAnnotations
        : document.content.annotations
    });
  }

  private async transformLiveState<T>(d: {
    documentId: string;
    transform: (state: string) => { delta: string | null; result: T };
  }) {
    let transformed = await internalDocumentCollaborationService.transformState({
      documentId: d.documentId,
      build: () => this.buildLiveState(d.documentId),
      transform: d.transform
    });
    if (!transformed?.delta) return transformed;

    await queueDocumentCollaborationFlush(d.documentId, transformed.revision ?? undefined);
    await publishDocumentLiveBusMessage({
      documentId: d.documentId,
      deliverToOriginInstance: true,
      type: 'yjs_update',
      data: {
        sessionId: 'server',
        update: transformed.delta,
        generation: transformed.generation
      }
    });

    return transformed;
  }

  async ensureLiveState(documentId: string) {
    return await internalDocumentCollaborationService.ensureState({
      documentId,
      build: () => this.buildLiveState(documentId)
    });
  }

  async applyCommentAnchor(d: {
    documentId: string;
    threadId: string;
    anchor: DocumentCommentAnchor;
  }) {
    let transformed = await this.transformLiveState({
      documentId: d.documentId,
      transform: stateUpdate => {
        let applied = applyCommentAnchorToYjsUpdate({
          stateUpdate,
          threadId: d.threadId,
          anchor: d.anchor
        });

        return { delta: applied?.update ?? null, result: applied?.quote ?? null };
      }
    });

    if (!transformed?.result) {
      throw new ServiceError(
        conflictError({
          message: 'The commented text changed before the comment could be attached'
        })
      );
    }

    return { quote: transformed.result };
  }

  async removeCommentAnchor(d: { documentId: string; threadId: string }) {
    await this.transformLiveState({
      documentId: d.documentId,
      transform: stateUpdate => ({
        delta:
          removeCommentAnchorFromYjsUpdate({ stateUpdate, threadId: d.threadId })?.update ??
          null,
        result: null
      })
    });
  }
}

export let documentLiveStateService = Service.create(
  'cargoDocumentLiveStateService',
  () => new DocumentLiveStateServiceImpl()
).build();
