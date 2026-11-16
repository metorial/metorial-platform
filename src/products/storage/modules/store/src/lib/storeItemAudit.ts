import type { StoreItemFabricOperation } from '@metorial/fabric';

export let auditedOperationLimit = 50;

type AuditableStoreItem = {
  id: string;
  kind: StoreItemFabricOperation['kind'];
  path: string;
  file?: { id: string } | null;
  document?: { id: string } | null;
};

export let toStoreItemAuditOperation = (
  type: StoreItemFabricOperation['type'],
  item: AuditableStoreItem,
  previousPath?: string
): StoreItemFabricOperation => ({
  type,
  kind: item.kind,
  path: item.path,
  ...(previousPath && previousPath !== item.path ? { previousPath } : {}),
  itemId: item.id,
  ...(item.file ? { fileId: item.file.id } : {}),
  ...(item.document ? { documentId: item.document.id } : {})
});

export let createStoreItemAuditRecorder = (limit = auditedOperationLimit) => {
  let operations: StoreItemFabricOperation[] = [];
  let counts = { add: 0, modify: 0, remove: 0 };

  return {
    record(
      type: StoreItemFabricOperation['type'],
      item: AuditableStoreItem,
      previousPath?: string
    ) {
      counts[type] += 1;
      if (operations.length < limit) {
        operations.push(toStoreItemAuditOperation(type, item, previousPath));
      }
    },

    get total() {
      return counts.add + counts.modify + counts.remove;
    },

    get summary() {
      return {
        operations,
        counts: { ...counts },
        truncated: this.total > operations.length
      };
    }
  };
};
