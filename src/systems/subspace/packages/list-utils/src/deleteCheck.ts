import { badRequestError, goneError, ServiceError } from '@lowerdeck/error';

let actionNameMap = {
  update: 'updated',
  delete: 'deleted',
  archive: 'archived'
};

export interface CheckDeletedRecordOpts {
  allowEphemeral?: boolean;
}

export interface DeletableRecord {
  id: string;
  isEphemeral?: boolean;
  status?: 'deleted' | 'archived' | string;
  createdAt: Date;
}

let isCreatedRecently = (d: DeletableRecord, ms: number) => {
  let now = Date.now();
  return now - d.createdAt.getTime() < ms;
};

export let isRecordDeleted = (
  d: DeletableRecord | null | undefined,
  opts?: CheckDeletedRecordOpts
) => {
  if (!d) return false;

  if (d.status === 'deleted' || d.status === 'archived') return true;

  if (d.isEphemeral) {
    // if (!opts?.allowEphemeral) return true;
    if (!isCreatedRecently(d, 15 * 1000)) return true;
  }

  return false;
};

export let checkDeletedEdit = (
  d: DeletableRecord,
  action: 'update' | 'delete' | 'archive',
  opts?: CheckDeletedRecordOpts
) => {
  if (isRecordDeleted(d, opts)) {
    throw new ServiceError(
      goneError({
        message: `Resource cannot be ${actionNameMap[action]}.`
      })
    );
  }
};

export let checkDeletedRelation = (
  d: DeletableRecord | undefined | null,
  opts?: CheckDeletedRecordOpts
) => {
  if (!d) return;

  if (isRecordDeleted(d, opts)) {
    throw new ServiceError(
      badRequestError({
        message: `Cannot use resource as it has been deleted or archived.`,
        entityId: d.id,
        code: 'use_after_delete'
      })
    );
  }
};
