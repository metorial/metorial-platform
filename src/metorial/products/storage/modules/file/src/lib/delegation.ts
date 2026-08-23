import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, ID, type File, type FileContentDelegator } from '@metorial/db';

export type FileContentDelegateResult =
  | {
      type: 'stream';
      stream: ReadableStream | AsyncIterable<Uint8Array>;
      contentLength?: number;
      mimeType?: string;
    }
  | { type: 'url'; url: string; expiresAt?: Date };

export interface FileContentDelegate {
  key: string;
  resolve(d: { file: File; ref: unknown }): Promise<FileContentDelegateResult>;
}

let registry = new Map<string, FileContentDelegate>();
let delegatorRowCacheByOid = new Map<string, FileContentDelegator>();

export let registerFileContentDelegate = async (delegate: FileContentDelegate) => {
  registry.set(delegate.key, delegate);

  let row = await db.fileContentDelegator.upsert({
    where: { key: delegate.key },
    create: { id: await ID.generateId('fileContentDelegator'), key: delegate.key },
    update: {}
  });
  delegatorRowCacheByOid.set(row.oid.toString(), row);
};

let getDelegatorRowByOid = async (delegatorOid: bigint) => {
  let cached = delegatorRowCacheByOid.get(delegatorOid.toString());
  if (cached) return cached;

  let row = await db.fileContentDelegator.findUnique({ where: { oid: delegatorOid } });
  if (!row) {
    throw new ServiceError(
      badRequestError({ message: `File content delegator ${delegatorOid} no longer exists` })
    );
  }

  delegatorRowCacheByOid.set(row.oid.toString(), row);
  return row;
};

export let resolveDelegatedFileContent = async (
  file: File
): Promise<FileContentDelegateResult | null> => {
  if (!file.delegatorOid) return null;

  if (
    file.delegatedContentUrl &&
    file.delegatedContentUrlExpiresAt &&
    file.delegatedContentUrlExpiresAt > new Date()
  ) {
    return {
      type: 'url',
      url: file.delegatedContentUrl,
      expiresAt: file.delegatedContentUrlExpiresAt
    };
  }

  let row = await getDelegatorRowByOid(file.delegatorOid);
  let delegate = registry.get(row.key);
  if (!delegate) {
    throw new ServiceError(
      badRequestError({
        message: `No file content delegate registered for key "${row.key}" in this process`
      })
    );
  }

  let result = await delegate.resolve({ file, ref: file.delegatorRef });

  if (result.type === 'url' && result.expiresAt) {
    await db.file.update({
      where: { oid: file.oid },
      data: { delegatedContentUrl: result.url, delegatedContentUrlExpiresAt: result.expiresAt }
    });
  }

  return result;
};
