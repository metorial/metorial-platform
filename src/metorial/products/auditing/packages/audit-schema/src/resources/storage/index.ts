import { resourceSet } from '../../_lib/resource';
import { documentAuditResource } from './document';
import { fileAuditResource } from './file';
import { storeAuditResource, storeItemsAuditResource } from './store';

export let storageResources = resourceSet({
  file: fileAuditResource,
  document: documentAuditResource,
  store: storeAuditResource,
  store_items: storeItemsAuditResource
});
