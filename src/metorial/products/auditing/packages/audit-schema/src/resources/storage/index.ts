import { resourceSet } from '../../_lib/resource';
import { documentAuditResource } from './document';
import {
  documentCommentAuditResource,
  documentCommentThreadAuditResource
} from './documentComment';
import { fileAuditResource } from './file';
import { storeAuditResource, storeItemsAuditResource } from './store';

export let storageResources = resourceSet({
  file: fileAuditResource,
  document: documentAuditResource,
  document_comment_thread: documentCommentThreadAuditResource,
  document_comment: documentCommentAuditResource,
  store: storeAuditResource,
  store_items: storeItemsAuditResource
});
