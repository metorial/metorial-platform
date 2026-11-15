import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let documentCommentThreadAuditResource = resource({
  name: 'document_comment_thread',
  payload: v.typedAny<{
    id: string;
    documentId: string;
    documentTitle: string;
    status: string;
    anchorStatus: string;
    resolvedAt: Date | null;
  }>('document_comment_thread'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let documentCommentAuditResource = resource({
  name: 'document_comment',
  payload: v.typedAny<{
    id: string;
    threadId: string;
    documentId: string;
    documentTitle: string;
    byteSize: number;
  }>('document_comment'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
