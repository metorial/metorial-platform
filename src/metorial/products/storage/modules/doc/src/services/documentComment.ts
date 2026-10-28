import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import type { Prisma } from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  type DocumentCommentAccessInput,
  internalDocumentCommentAccessService
} from '../internal/documentCommentAccess';
import {
  documentCommentInclude,
  type DocumentCommentThreadRecord,
  publishDocumentCommentThreadUpdated
} from './documentCommentThread';

export type DocumentCommentRecord = Prisma.DocumentCommentGetPayload<{
  include: typeof documentCommentInclude;
}>;

class DocumentCommentServiceImpl {
  async getDocumentCommentById(
    d: DocumentCommentAccessInput & { thread: DocumentCommentThreadRecord; commentId: string }
  ) {
    await internalDocumentCommentAccessService.assertCanRead(d);

    let comment = await db.documentComment.findFirst({
      where: { id: d.commentId, threadOid: d.thread.oid, deletedAt: null },
      include: documentCommentInclude
    });
    if (!comment) {
      throw new ServiceError(notFoundError('document.comment', d.commentId));
    }

    return comment;
  }

  async createDocumentComment(
    d: DocumentCommentAccessInput & {
      auditScope: AuditScope;
      thread: DocumentCommentThreadRecord;
      input: { body: string };
    }
  ) {
    let actor = await internalDocumentCommentAccessService.assertCanComment(d);
    let body = internalDocumentCommentAccessService.normalizeBody(d.input.body);

    return await withTransaction(async db => {
      let comment = await db.documentComment.create({
        data: {
          id: await ID.generateId('documentComment'),
          body,
          threadOid: d.thread.oid,
          resourceActorOid: actor.oid
        },
        include: documentCommentInclude
      });
      await db.documentCommentThread.update({
        where: { oid: d.thread.oid },
        data: { updatedAt: new Date() }
      });

      await Fabric.fire('document.comment.created:after', {
        instance: d.instance,
        auditScope: d.auditScope,
        document: { id: d.document.id, title: d.document.title },
        thread: d.thread,
        comment
      });
      await publishDocumentCommentThreadUpdated({
        documentId: d.document.id,
        threadId: d.thread.id
      });

      return comment;
    });
  }

  async updateDocumentComment(
    d: DocumentCommentAccessInput & {
      auditScope: AuditScope;
      thread: DocumentCommentThreadRecord;
      comment: DocumentCommentRecord;
      input: { body: string };
    }
  ) {
    await this.assertAuthor(d);
    let body = internalDocumentCommentAccessService.normalizeBody(d.input.body);
    if (body === d.comment.body) return d.comment;

    return await withTransaction(async db => {
      let comment = await db.documentComment.update({
        where: { oid: d.comment.oid },
        data: { body, editedAt: new Date() },
        include: documentCommentInclude
      });

      await Fabric.fire('document.comment.updated:after', {
        instance: d.instance,
        auditScope: d.auditScope,
        document: { id: d.document.id, title: d.document.title },
        thread: d.thread,
        comment,
        previousComment: d.comment
      });
      await publishDocumentCommentThreadUpdated({
        documentId: d.document.id,
        threadId: d.thread.id
      });

      return comment;
    });
  }

  async deleteDocumentComment(
    d: DocumentCommentAccessInput & {
      auditScope: AuditScope;
      thread: DocumentCommentThreadRecord;
      comment: DocumentCommentRecord;
    }
  ) {
    await this.assertAuthor(d);

    return await withTransaction(async db => {
      let comment = await db.documentComment.update({
        where: { oid: d.comment.oid },
        data: { deletedAt: new Date() },
        include: documentCommentInclude
      });

      await Fabric.fire('document.comment.deleted:after', {
        instance: d.instance,
        auditScope: d.auditScope,
        document: { id: d.document.id, title: d.document.title },
        thread: d.thread,
        comment
      });
      await publishDocumentCommentThreadUpdated({
        documentId: d.document.id,
        threadId: d.thread.id
      });

      return comment;
    });
  }

  private async assertAuthor(
    d: DocumentCommentAccessInput & { comment: DocumentCommentRecord }
  ) {
    let actor = await internalDocumentCommentAccessService.assertCanComment(d);
    if (d.comment.resourceActorOid !== actor.oid) {
      throw new ServiceError(
        forbiddenError({ message: 'Only the comment author can change this comment' })
      );
    }
  }
}

export let documentCommentService = Service.create(
  'cargoDocumentCommentService',
  () => new DocumentCommentServiceImpl()
).build();
