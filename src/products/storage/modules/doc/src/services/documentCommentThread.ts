import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import type {
  DocumentCommentThreadAnchorStatus,
  DocumentCommentThreadStatus,
  Prisma
} from '@metorial/db';
import { addAfterTransactionHook, db, ID, withTransaction } from '@metorial/db';
import type { DocumentCommentAnchor } from '@metorial/docs-editor-schema';
import { Fabric } from '@metorial/fabric';
import { type DateFilter, normalizeDateFilter } from '@metorial/list-utils';
import { resourceActorPresentationInclude } from '@metorial/module-resource-actor';
import {
  type DocumentCommentAccessInput,
  internalDocumentCommentAccessService
} from '../internal/documentCommentAccess';
import { publishDocumentLiveBusMessage } from '../live/documentLiveBus';
import { documentLiveStateService } from './documentLiveState';

export let documentCommentInclude = {
  resourceActor: {
    include: resourceActorPresentationInclude
  }
} satisfies Prisma.DocumentCommentInclude;

export let documentCommentThreadInclude = {
  document: true,
  createdByResourceActor: {
    include: resourceActorPresentationInclude
  },
  resolvedByResourceActor: {
    include: resourceActorPresentationInclude
  },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: documentCommentInclude
  }
} satisfies Prisma.DocumentCommentThreadInclude;

export type DocumentCommentThreadRecord = Prisma.DocumentCommentThreadGetPayload<{
  include: typeof documentCommentThreadInclude;
}>;

export let publishDocumentCommentThreadUpdated = async (d: {
  documentId: string;
  threadId: string;
}) => {
  await addAfterTransactionHook(async () => {
    await publishDocumentLiveBusMessage({
      documentId: d.documentId,
      deliverToOriginInstance: true,
      type: 'document_comment_thread_updated',
      data: { threadIds: [d.threadId] }
    });
  });
};

let maxQuoteLength = 2_000;

class DocumentCommentThreadServiceImpl {
  async getDocumentCommentThreadById(d: DocumentCommentAccessInput & { threadId: string }) {
    await internalDocumentCommentAccessService.assertCanRead(d);

    let thread = await db.documentCommentThread.findFirst({
      where: { id: d.threadId, documentOid: d.document.oid, deletedAt: null },
      include: documentCommentThreadInclude
    });
    if (!thread) {
      throw new ServiceError(notFoundError('document.comment_thread', d.threadId));
    }

    return thread;
  }

  async listDocumentCommentThreads(
    d: DocumentCommentAccessInput & {
      ids?: string[];
      statuses?: DocumentCommentThreadStatus[];
      anchorStatuses?: DocumentCommentThreadAnchorStatus[];
      createdAt?: DateFilter;
    }
  ) {
    await internalDocumentCommentAccessService.assertCanRead(d);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.documentCommentThread.findMany({
            ...opts,
            where: {
              documentOid: d.document.oid,
              deletedAt: null,
              id: d.ids?.length ? { in: d.ids } : undefined,
              status: d.statuses?.length ? { in: d.statuses } : undefined,
              anchorStatus: d.anchorStatuses?.length ? { in: d.anchorStatuses } : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined
            },
            include: documentCommentThreadInclude
          })
      )
    );
  }

  async createDocumentCommentThread(
    d: DocumentCommentAccessInput & {
      auditScope: AuditScope;
      input: { anchor: DocumentCommentAnchor; body: string };
    }
  ) {
    if (d.document.isReadOnly) {
      throw new ServiceError(
        forbiddenError({ message: `Document ${d.document.id} is read-only` })
      );
    }

    let actor = await internalDocumentCommentAccessService.assertCanComment(d);
    let body = internalDocumentCommentAccessService.normalizeBody(d.input.body);
    if (!d.input.anchor.quote.trim() || d.input.anchor.quote.length > maxQuoteLength) {
      throw new ServiceError(
        badRequestError({ message: 'Comments must reference a non-empty text selection' })
      );
    }

    return await withTransaction(async db => {
      let threadId = await ID.generateId('documentCommentThread');
      let thread = await db.documentCommentThread.create({
        data: {
          id: threadId,
          quote: d.input.anchor.quote,
          documentOid: d.document.oid,
          createdByResourceActorOid: actor.oid
        }
      });
      let comment = await db.documentComment.create({
        data: {
          id: await ID.generateId('documentComment'),
          body,
          threadOid: thread.oid,
          resourceActorOid: actor.oid
        }
      });

      let { quote } = await documentLiveStateService.applyCommentAnchor({
        documentId: d.document.id,
        threadId,
        anchor: d.input.anchor
      });
      if (quote !== thread.quote) {
        thread = await db.documentCommentThread.update({
          where: { oid: thread.oid },
          data: { quote }
        });
      }

      await Fabric.fire('document.comment_thread.created:after', {
        instance: d.instance,
        auditScope: d.auditScope,
        document: { id: d.document.id, title: d.document.title },
        thread,
        comment
      });
      await publishDocumentCommentThreadUpdated({ documentId: d.document.id, threadId });

      return await db.documentCommentThread.findUniqueOrThrow({
        where: { oid: thread.oid },
        include: documentCommentThreadInclude
      });
    });
  }

  async updateDocumentCommentThread(
    d: DocumentCommentAccessInput & {
      auditScope: AuditScope;
      thread: DocumentCommentThreadRecord;
      input: { status?: DocumentCommentThreadStatus };
    }
  ) {
    let actor = await internalDocumentCommentAccessService.assertCanComment(d);
    if (!d.input.status || d.input.status === d.thread.status) return d.thread;

    let isAuthor = d.thread.createdByResourceActorOid === actor.oid;
    if (!isAuthor && !(await internalDocumentCommentAccessService.canWrite(d))) {
      throw new ServiceError(
        forbiddenError({
          message: 'Only the thread author or document editors can resolve comment threads'
        })
      );
    }

    let resolving = d.input.status === 'resolved';

    return await withTransaction(async db => {
      let thread = await db.documentCommentThread.update({
        where: { oid: d.thread.oid },
        data: {
          status: d.input.status,
          resolvedAt: resolving ? new Date() : null,
          resolvedByResourceActorOid: resolving ? actor.oid : null
        },
        include: documentCommentThreadInclude
      });

      await Fabric.fire('document.comment_thread.updated:after', {
        instance: d.instance,
        auditScope: d.auditScope,
        document: { id: d.document.id, title: d.document.title },
        thread,
        previousThread: d.thread
      });
      await publishDocumentCommentThreadUpdated({
        documentId: d.document.id,
        threadId: thread.id
      });

      return thread;
    });
  }

  async deleteDocumentCommentThread(
    d: DocumentCommentAccessInput & {
      auditScope: AuditScope;
      thread: DocumentCommentThreadRecord;
    }
  ) {
    await internalDocumentCommentAccessService.assertCanRead(d);
    if (!(await internalDocumentCommentAccessService.canWrite(d))) {
      throw new ServiceError(
        forbiddenError({ message: 'Only document editors can delete comment threads' })
      );
    }

    return await withTransaction(async db => {
      let thread = await db.documentCommentThread.update({
        where: { oid: d.thread.oid },
        data: { deletedAt: new Date() },
        include: documentCommentThreadInclude
      });

      if (!d.document.isReadOnly) {
        await documentLiveStateService.removeCommentAnchor({
          documentId: d.document.id,
          threadId: thread.id
        });
      }

      await Fabric.fire('document.comment_thread.deleted:after', {
        instance: d.instance,
        auditScope: d.auditScope,
        document: { id: d.document.id, title: d.document.title },
        thread
      });
      await publishDocumentCommentThreadUpdated({
        documentId: d.document.id,
        threadId: thread.id
      });

      return thread;
    });
  }
}

export let documentCommentThreadService = Service.create(
  'cargoDocumentCommentThreadService',
  () => new DocumentCommentThreadServiceImpl()
).build();
