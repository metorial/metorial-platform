import {
  badRequestError,
  conflictError,
  createError,
  isServiceError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import type {
  Instance,
  Prisma,
  Project,
  StoreParticipantPermissions,
  StorePathMode
} from '@metorial/db';
import { db } from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import {
  flushDocumentCollaborationState,
  internalDocumentDraftService
} from '@metorial/module-documents';
import {
  filePurposeService,
  fileService,
  getSignedFileDownloadUrl
} from '@metorial/module-file';
import {
  assertSkillStoreItemAllowed,
  isInSkillAgentsDirectory,
  isSkillAgentPath,
  normalizeStorePath,
  skillRootDocumentPath,
  storeAccessService,
  storeItemMutationService,
  storeReadPermission
} from '@metorial/module-store';
import { createHash } from 'node:crypto';
import { posix as path } from 'node:path';
import PQueue from 'p-queue';
import {
  getSkillDocumentTitle,
  isSkillDocumentPath,
  upsertSkillDocument
} from '../lib/skillDocument';
import { renderSkillDocumentFrontmatter, skillDocumentPath } from '../lib/skillFrontmatter';
import { withSkillStoreMutationLock } from '../lib/skillStoreLock';
import { skillService, type SkillRecord } from './skill';

let maxSkillFileContentBytes = 5 * 1024 * 1024;
let maxSkillFileBatchOperations = 100;
let snapshotHashConcurrency = 5;

let textMimeTypes: Record<string, string> = {
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.ts': 'text/x-typescript',
  '.py': 'text/x-python',
  '.sh': 'application/x-sh',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.html': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv'
};

let skillFileItemInclude = {
  file: true,
  document: {
    include: {
      content: true
    }
  }
} satisfies Prisma.StoreItemInclude;

type SkillFileItemRecord = Prisma.StoreItemGetPayload<{
  include: typeof skillFileItemInclude;
}>;

export type SkillFile = {
  path: string;
  kind: 'document' | 'file';
  size: number;
  etag: string;
  storeItemId: string;
  documentId: string | null;
  fileId: string | null;
  updatedAt: Date;
};

export type SkillFileContent = SkillFile & {
  content: string | null;
  downloadUrl: string | null;
};

export type SkillFileText = SkillFile & {
  content: string | null;
};

export type SkillSnapshotEntry = {
  path: string;
  mimeType: string;
  size: number;
};

export type SkillSnapshotFile = SkillSnapshotEntry & {
  sha256: string;
  text: string | null;
};

export type SkillSnapshotFileContent = SkillSnapshotFile & {
  bytes: Uint8Array;
};

type SkillSnapshotSource =
  | { path: string; document: NonNullable<SkillFileItemRecord['document']>; file: null }
  | { path: string; document: null; file: NonNullable<SkillFileItemRecord['file']> };

export type SkillSnapshotOptions = {
  includePath?: (path: string) => boolean;
  limits?: { maxFiles: number; maxBytes: number };
  skillName?: string;
};

type SkillSnapshotInput = {
  project: Project;
  instance: Instance;
  skill: SkillRecord;
  authorization: ResourceAuthorization;
  options?: SkillSnapshotOptions;
};

export type SkillSnapshotLimit = 'file_count' | 'size';

export type SkillSnapshotUsage = {
  fileCount: number;
  size: number;
  exceededLimits: SkillSnapshotLimit[];
};

export type SkillFileChange =
  | {
      type: 'put';
      path: string;
      content?: string;
      fileId?: string;
      ifMatch?: string | null;
    }
  | {
      type: 'delete';
      path: string;
      ifMatch?: string;
    }
  | {
      type: 'move';
      path: string;
      toPath: string;
      ifMatch?: string;
    };

export type SkillFileChangeResult = {
  type: SkillFileChange['type'];
  path: string;
  previousPath: string | null;
  file: SkillFile | null;
};

type AppliedSkillFileChange = {
  type: SkillFileChange['type'];
  path: string;
  previousPath: string | null;
  item: SkillFileItemRecord | null;
};

let getTextByteSize = (content: string) => new TextEncoder().encode(content).length;

let getStoredSnapshotBytes = (sources: SkillSnapshotSource[]) =>
  sources.reduce(
    (sum, source) =>
      sum +
      (source.document
        ? getTextByteSize(source.document.content.content)
        : Number(source.file.fileSize)),
    0
  );

let getServedSnapshotBytes = (entries: SkillSnapshotEntry[]) =>
  entries.reduce((sum, entry) => sum + entry.size, 0);

let hashContent = (content: string | Uint8Array) =>
  createHash('sha256').update(content).digest('hex');

let documentMimeType = 'text/markdown';

let decodeSkillFileText = (bytes: Uint8Array) => {
  if (bytes.includes(0)) return null;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
};

let prefixChangeError = (d: {
  index: number;
  error: ServiceError<any>;
  appliedCount?: number;
}) => {
  let applied = '';
  if (d.appliedCount) {
    applied =
      d.appliedCount === 1
        ? ' (1 earlier change was applied)'
        : ` (${d.appliedCount} earlier changes were applied)`;
  }

  return new ServiceError(
    createError({
      ...d.error.data,
      message: `changes[${d.index}]: ${d.error.data.message}${applied}`
    })
  );
};

type ApplySkillFileChangesProps = {
  project: Project;
  instance: Instance;
  auditScope: AuditScope;
  skill: SkillRecord;
  authorization: ResourceAuthorization;
  defaultPermissions?: StoreParticipantPermissions[];
  overridePermissions?: boolean;
};

class SkillFileServiceImpl {
  private parseSkillFilePath(input: string, mode: StorePathMode) {
    let expectedPath = input.startsWith('/') ? input : `/${input}`;
    let normalized = normalizeStorePath({ path: input, kind: 'file', mode });

    if (normalized.path !== expectedPath) {
      throw new ServiceError(
        badRequestError({
          message: `Invalid skill file path "${input}"`,
          description:
            mode === 'unicode'
              ? 'Paths must be "/"-separated segments without surrounding whitespace, "." or ".." segments, and must be in Unicode NFC form.'
              : 'Paths may only contain letters, numbers, spaces and the characters . _ - ( ) $, separated by "/".'
        })
      );
    }

    return normalized;
  }

  private normalizeSkillFilePath(input: string, mode: StorePathMode) {
    return this.parseSkillFilePath(input, mode).path;
  }

  private assertSkillActive(skill: SkillRecord) {
    if (skill.status !== 'active') {
      throw new ServiceError(
        badRequestError({ message: 'Files can only be changed on active skills' })
      );
    }
  }

  private assertContentSize(content: string) {
    let size = getTextByteSize(content);
    if (size <= maxSkillFileContentBytes) return;

    throw new ServiceError(
      badRequestError({
        message: `Skill file content cannot exceed ${maxSkillFileContentBytes} bytes; received ${size} bytes`
      })
    );
  }

  private async getItemByPath(d: { skill: SkillRecord; path: string }) {
    return await db.storeItem.findFirst({
      where: {
        storeOid: d.skill.store!.oid,
        path: d.path,
        kind: { in: ['document', 'file'] }
      },
      include: skillFileItemInclude
    });
  }

  private async resolveDocumentContent(d: {
    document: NonNullable<SkillFileItemRecord['document']>;
    flushLiveEdits: boolean;
  }) {
    if (d.flushLiveEdits) {
      await flushDocumentCollaborationState({ documentId: d.document.id });
    }

    let draft = await internalDocumentDraftService.getDraftByDocumentId(d.document.id);
    return draft?.content ?? d.document.content.content;
  }

  private async presentItem(d: {
    item: SkillFileItemRecord;
    flushLiveEdits: boolean;
  }): Promise<{ file: SkillFile; content: string | null }> {
    let base = {
      path: d.item.path,
      storeItemId: d.item.id,
      updatedAt: d.item.updatedAt
    };

    if (d.item.document) {
      let content = await this.resolveDocumentContent({
        document: d.item.document,
        flushLiveEdits: d.flushLiveEdits
      });

      return {
        file: {
          ...base,
          kind: 'document',
          size: getTextByteSize(content),
          etag: hashContent(content),
          documentId: d.item.document.id,
          fileId: null
        },
        content
      };
    }

    return {
      file: {
        ...base,
        kind: 'file',
        size: Number(d.item.file?.fileSize ?? 0),
        etag: d.item.file?.id ?? d.item.id,
        documentId: null,
        fileId: d.item.file?.id ?? null
      },
      content: null
    };
  }

  private async assertIfMatch(d: {
    path: string;
    ifMatch: string | null | undefined;
    item: SkillFileItemRecord | null;
  }) {
    if (d.ifMatch === undefined) return;

    let current = d.item
      ? (await this.presentItem({ item: d.item, flushLiveEdits: true })).file
      : null;
    if (d.ifMatch === (current?.etag ?? null)) return;

    if (current && d.ifMatch === null) {
      throw new ServiceError(
        preconditionFailedError({
          code: 'skill_file_exists',
          message: `A file already exists at "${d.path}"`,
          description: 'Read the file and pass its etag as if_match to replace it.'
        })
      );
    }

    if (!current) {
      throw new ServiceError(
        preconditionFailedError({
          code: 'skill_file_missing',
          message: `The skill file "${d.path}" no longer exists`,
          description: 'List the files of the skill again.'
        })
      );
    }

    throw new ServiceError(
      preconditionFailedError({
        code: 'skill_file_changed',
        message: `The skill file "${d.path}" was changed by someone else since you read it`,
        description: 'Fetch the latest version of the file and try again.'
      })
    );
  }

  private assertInlineReadSize(d: { path: string; size: number; maxBytes: number }) {
    if (d.size <= d.maxBytes) return;

    throw new ServiceError(
      badRequestError({
        code: 'skill_file_too_large',
        message: `The skill file "${d.path}" is too large to read inline (${d.size} bytes; the limit is ${d.maxBytes} bytes)`
      })
    );
  }

  private async assertReadAccess(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }) {
    await storeAccessService.assertStoreAccessForStore({
      project: d.project,
      instance: d.instance,
      store: d.skill.store!,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });
  }

  private async assertAttachableFile(d: {
    project: Project;
    instance: Instance;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    fileId: string;
  }) {
    let file = await fileService
      .getFileById({
        project: d.project,
        instance: d.instance,
        fileId: d.fileId,
        authorization: d.authorization,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions
      })
      .catch(error => {
        if (isServiceError(error) && error.data.code === 'forbidden') {
          throw new ServiceError(notFoundError('file', d.fileId));
        }

        throw error;
      });

    if (file.status !== 'active') throw new ServiceError(notFoundError('file', d.fileId));

    if (file.document) {
      throw new ServiceError(
        badRequestError({
          message: `File "${d.fileId}" belongs to a document and cannot be attached`,
          description: 'Use content to write markdown documents.'
        })
      );
    }
  }

  private prepareChange(change: SkillFileChange, mode: StorePathMode): SkillFileChange {
    switch (change.type) {
      case 'put': {
        let parsedPath = this.parseSkillFilePath(change.path, mode);
        let filePath = parsedPath.path;

        if ((change.content === undefined) === (change.fileId === undefined)) {
          throw new ServiceError(
            badRequestError({
              message: `Exactly one of content or file_id must be provided for "${filePath}"`
            })
          );
        }

        if (change.content !== undefined) this.assertContentSize(change.content);

        assertSkillStoreItemAllowed({
          path: parsedPath,
          kind:
            change.content !== undefined && isSkillDocumentPath(filePath) ? 'document' : 'file'
        });

        return { ...change, path: filePath };
      }

      case 'delete': {
        let filePath = this.normalizeSkillFilePath(change.path, mode);

        if (filePath === skillRootDocumentPath) {
          throw new ServiceError(
            badRequestError({ message: 'SKILL.md cannot be removed from a skill' })
          );
        }

        return { ...change, path: filePath };
      }

      case 'move': {
        let fromPath = this.normalizeSkillFilePath(change.path, mode);
        let parsedToPath = this.parseSkillFilePath(change.toPath, mode);
        let toPath = parsedToPath.path;

        if (fromPath === toPath) {
          throw new ServiceError(
            badRequestError({ message: `The from and to paths are the same ("${fromPath}")` })
          );
        }

        if (fromPath === skillRootDocumentPath) {
          throw new ServiceError(
            badRequestError({ message: 'SKILL.md cannot be moved in a skill' })
          );
        }

        if (isInSkillAgentsDirectory(parsedToPath) && !isSkillAgentPath(parsedToPath)) {
          throw new ServiceError(
            badRequestError({ message: 'Only markdown documents can be moved into agents/' })
          );
        }

        return { ...change, path: fromPath, toPath };
      }
    }
  }

  private async prepareChanges(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    changes: SkillFileChange[];
    indexErrors: boolean;
  }) {
    let prepared: SkillFileChange[] = [];

    for (let [index, change] of d.changes.entries()) {
      try {
        let preparedChange = this.prepareChange(change, d.skill.store!.pathMode);

        if (preparedChange.type === 'put' && preparedChange.fileId !== undefined) {
          await this.assertAttachableFile({ ...d, fileId: preparedChange.fileId });
        }

        prepared.push(preparedChange);
      } catch (error) {
        if (!isServiceError(error) || !d.indexErrors) throw error;

        throw prefixChangeError({ index, error });
      }
    }

    return prepared;
  }

  private async putDocument(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    path: string;
    existing: SkillFileItemRecord | null;
    content: string;
  }) {
    await upsertSkillDocument({
      project: d.project,
      instance: d.instance,
      auditScope: d.auditScope,
      store: d.skill.store!,
      path: d.path,
      existingItem: d.existing,
      actor: d.authorization.resourceActor,
      title: getSkillDocumentTitle({
        path: d.path,
        content: d.content,
        skillName: d.skill.name
      }),
      keepExistingTitle: true,
      content: d.content
    });
  }

  private async putStoredFile(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    path: string;
    existing: SkillFileItemRecord | null;
    content?: string;
    fileId?: string;
  }) {
    let fileId = d.fileId;
    let uploadedFileId: string | null = null;

    if (d.content !== undefined) {
      let genericPurpose = await filePurposeService.ensureGenericFilePurpose();
      let mimeType = textMimeTypes[path.extname(d.path).toLowerCase()] ?? 'text/plain';

      let uploadedFile = await fileService.createUploadedFile({
        project: d.project,
        instance: d.instance,
        auditScope: d.auditScope,
        purpose: genericPurpose.id,
        file: new Blob([d.content], { type: mimeType }),
        input: {
          name: path.basename(d.path),
          title: path.basename(d.path),
          mimeType,
          authorization: { type: 'privileged', resourceActor: d.authorization.resourceActor }
        }
      });

      fileId = uploadedFileId = uploadedFile.id;
    }

    try {
      await storeItemMutationService.modifyStoreItems({
        project: d.project,
        instance: d.instance,
        auditScope: d.auditScope,
        store: d.skill.store!,
        actor: d.authorization.resourceActor,
        operations: [
          d.existing
            ? { type: 'modify', itemId: d.existing.id, fileId }
            : { type: 'add', path: d.path, fileId }
        ]
      });
    } catch (error) {
      if (uploadedFileId) await this.expireOrphanedUpload(uploadedFileId);

      throw error;
    }
  }

  // deleteFile refuses read-only uploads; expiring hands cleanup to the expiration cron.
  private async expireOrphanedUpload(fileId: string) {
    await fileService
      .updateFileExpiry({ file: { id: fileId }, expiresAt: new Date() })
      .catch(error =>
        console.error(`Failed to expire orphaned skill file upload ${fileId}`, error)
      );
  }

  private async putFile(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    change: Extract<SkillFileChange, { type: 'put' }>;
  }): Promise<AppliedSkillFileChange> {
    let filePath = d.change.path;
    let { content, fileId } = d.change;

    let existing = await this.getItemByPath({ skill: d.skill, path: filePath });
    await this.assertIfMatch({ path: filePath, ifMatch: d.change.ifMatch, item: existing });

    if (content !== undefined && (existing?.document || isSkillDocumentPath(filePath))) {
      await this.putDocument({ ...d, path: filePath, existing, content });
    } else {
      await this.putStoredFile({ ...d, path: filePath, existing, content, fileId });
    }

    return {
      type: 'put',
      path: filePath,
      previousPath: null,
      item: await this.getItemByPath({ skill: d.skill, path: filePath })
    };
  }

  private async deleteFile(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    change: Extract<SkillFileChange, { type: 'delete' }>;
  }): Promise<AppliedSkillFileChange> {
    let filePath = d.change.path;

    let existing = await this.getItemByPath({ skill: d.skill, path: filePath });
    if (!existing) throw new ServiceError(notFoundError('skill.file', filePath));

    await this.assertIfMatch({ path: filePath, ifMatch: d.change.ifMatch, item: existing });

    await storeItemMutationService.modifyStoreItems({
      project: d.project,
      instance: d.instance,
      auditScope: d.auditScope,
      store: d.skill.store!,
      actor: d.authorization.resourceActor,
      operations: [{ type: 'remove', itemId: existing.id }]
    });

    return { type: 'delete', path: filePath, previousPath: null, item: null };
  }

  private async moveFile(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    change: Extract<SkillFileChange, { type: 'move' }>;
  }): Promise<AppliedSkillFileChange> {
    let fromPath = d.change.path;
    let toPath = d.change.toPath;

    let existing = await this.getItemByPath({ skill: d.skill, path: fromPath });
    if (!existing) throw new ServiceError(notFoundError('skill.file', fromPath));

    await this.assertIfMatch({ path: fromPath, ifMatch: d.change.ifMatch, item: existing });

    if (await this.getItemByPath({ skill: d.skill, path: toPath })) {
      throw new ServiceError(
        conflictError({ message: `A skill file already exists at "${toPath}"` })
      );
    }

    await storeItemMutationService.modifyStoreItems({
      project: d.project,
      instance: d.instance,
      auditScope: d.auditScope,
      store: d.skill.store!,
      actor: d.authorization.resourceActor,
      operations: [{ type: 'modify', itemId: existing.id, path: toPath }]
    });

    return {
      type: 'move',
      path: toPath,
      previousPath: fromPath,
      item: await this.getItemByPath({ skill: d.skill, path: toPath })
    };
  }

  private async applyChange(d: {
    project: Project;
    instance: Instance;
    auditScope: AuditScope;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    change: SkillFileChange;
  }) {
    let { change } = d;

    switch (change.type) {
      case 'put':
        return await this.putFile({ ...d, change });
      case 'delete':
        return await this.deleteFile({ ...d, change });
      case 'move':
        return await this.moveFile({ ...d, change });
    }
  }

  async listSkillFiles(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
  }): Promise<SkillFile[]> {
    await this.assertReadAccess(d);

    let items = await db.storeItem.findMany({
      where: {
        storeOid: d.skill.store!.oid,
        kind: { in: ['document', 'file'] }
      },
      include: skillFileItemInclude,
      orderBy: { path: 'asc' }
    });

    return await Promise.all(
      items.map(async item => (await this.presentItem({ item, flushLiveEdits: false })).file)
    );
  }

  async getSkillFile(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    path: string;
  }): Promise<SkillFileContent> {
    await this.assertReadAccess(d);

    let filePath = this.normalizeSkillFilePath(d.path, d.skill.store!.pathMode);
    let item = await this.getItemByPath({ skill: d.skill, path: filePath });
    if (!item) throw new ServiceError(notFoundError('skill.file', filePath));

    let { file, content } = await this.presentItem({ item, flushLiveEdits: true });
    let downloadUrl =
      item.file && !item.document ? await getSignedFileDownloadUrl(item.file) : null;

    return {
      ...file,
      content,
      downloadUrl: downloadUrl ?? null
    };
  }

  async readSkillFileText(d: {
    project: Project;
    instance: Instance;
    skill: SkillRecord;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    path: string;
    maxBytes?: number;
  }): Promise<SkillFileText> {
    let maxBytes = d.maxBytes ?? maxSkillFileContentBytes;

    await this.assertReadAccess(d);

    let filePath = this.normalizeSkillFilePath(d.path, d.skill.store!.pathMode);
    let item = await this.getItemByPath({ skill: d.skill, path: filePath });
    if (!item) throw new ServiceError(notFoundError('skill.file', filePath));

    let { file, content } = await this.presentItem({ item, flushLiveEdits: true });
    this.assertInlineReadSize({ path: filePath, size: file.size, maxBytes });

    if (content !== null || !item.file) return { ...file, content: content ?? '' };

    let bytes = await fileService.downloadFileContent({ file: item.file });
    this.assertInlineReadSize({ path: filePath, size: bytes.byteLength, maxBytes });

    return { ...file, content: decodeSkillFileText(bytes) };
  }

  private async snapshotDocument(d: {
    skill: SkillRecord;
    source: Extract<SkillSnapshotSource, { file: null }>;
    skillName?: string;
  }): Promise<SkillSnapshotFileContent> {
    let content = await this.resolveDocumentContent({
      document: d.source.document,
      flushLiveEdits: false
    });
    let text =
      d.source.path === skillDocumentPath
        ? renderSkillDocumentFrontmatter(content, { skill: d.skill, name: d.skillName })
        : content;
    let bytes = new TextEncoder().encode(text);

    return {
      path: d.source.path,
      mimeType: documentMimeType,
      size: bytes.byteLength,
      sha256: hashContent(bytes),
      text,
      bytes
    };
  }

  private async snapshotSource(d: {
    skill: SkillRecord;
    source: SkillSnapshotSource;
    skillName?: string;
  }): Promise<SkillSnapshotFileContent> {
    if (d.source.document) {
      return await this.snapshotDocument({
        skill: d.skill,
        source: d.source,
        skillName: d.skillName
      });
    }

    let bytes = await fileService.downloadFileContent({ file: d.source.file });

    return {
      path: d.source.path,
      mimeType: d.source.file.fileType,
      size: bytes.byteLength,
      sha256: hashContent(bytes),
      text: decodeSkillFileText(bytes),
      bytes
    };
  }

  // Limits are checked from stored sizes before anything is hashed or downloaded.
  private async loadSnapshotSources(d: { skill: SkillRecord; options: SkillSnapshotOptions }) {
    let items = await db.storeItem.findMany({
      where: {
        storeOid: d.skill.store!.oid,
        kind: { in: ['document', 'file'] }
      },
      include: skillFileItemInclude,
      orderBy: { path: 'asc' }
    });

    let sources = items.flatMap((item): SkillSnapshotSource[] => {
      if (d.options.includePath && !d.options.includePath(item.path)) return [];
      if (item.document) return [{ path: item.path, document: item.document, file: null }];
      if (item.file) return [{ path: item.path, document: null, file: item.file }];

      return [];
    });

    let limits = d.options.limits;
    if (!limits) return sources;
    if (sources.length > limits.maxFiles) return null;
    if (getStoredSnapshotBytes(sources) > limits.maxBytes) return null;

    return sources;
  }

  private async mapSnapshotSources<T>(
    sources: SkillSnapshotSource[],
    toEntry: (source: SkillSnapshotSource) => Promise<T>
  ) {
    let queue = new PQueue({ concurrency: snapshotHashConcurrency });

    return await Promise.all(sources.map(source => queue.add(() => toEntry(source))));
  }

  private async snapshotEntry(d: {
    skill: SkillRecord;
    source: SkillSnapshotSource;
    skillName?: string;
  }): Promise<SkillSnapshotEntry> {
    if (d.source.document) {
      let { path, mimeType, size } = await this.snapshotDocument({
        skill: d.skill,
        source: d.source,
        skillName: d.skillName
      });

      return { path, mimeType, size };
    }

    return {
      path: d.source.path,
      mimeType: d.source.file.fileType,
      size: Number(d.source.file.fileSize)
    };
  }

  private async collectSnapshot<T extends SkillSnapshotEntry>(
    d: SkillSnapshotInput,
    toEntry: (source: SkillSnapshotSource, options: SkillSnapshotOptions) => Promise<T>
  ): Promise<T[] | null> {
    await this.assertReadAccess(d);

    let options = d.options ?? {};
    let sources = await this.loadSnapshotSources({ skill: d.skill, options });
    if (!sources) return null;

    let entries = await this.mapSnapshotSources(sources, source => toEntry(source, options));
    if (options.limits && getServedSnapshotBytes(entries) > options.limits.maxBytes)
      return null;

    return entries;
  }

  async listSkillSnapshotFiles(d: SkillSnapshotInput): Promise<SkillSnapshotFile[] | null> {
    return await this.collectSnapshot(d, async (source, options) => {
      if (source.document) {
        let { bytes: _bytes, ...file } = await this.snapshotDocument({
          skill: d.skill,
          source,
          skillName: options.skillName
        });

        return file;
      }

      return {
        path: source.path,
        mimeType: source.file.fileType,
        size: Number(source.file.fileSize),
        sha256: await fileService.getContentSha256({ file: source.file }),
        text: null
      };
    });
  }

  async listSkillSnapshotEntries(d: SkillSnapshotInput): Promise<SkillSnapshotEntry[] | null> {
    return await this.collectSnapshot(d, (source, options) =>
      this.snapshotEntry({ skill: d.skill, source, skillName: options.skillName })
    );
  }

  // A snapshot is refused when it has too many files, or when either its stored or its served
  // (SKILL.md rendered with frontmatter) size is over the limit, so `size` is the larger one.
  async getSkillSnapshotUsage(
    d: Omit<SkillSnapshotInput, 'options'> & {
      options: SkillSnapshotOptions & { limits: NonNullable<SkillSnapshotOptions['limits']> };
      defaultPermissions?: StoreParticipantPermissions[];
      overridePermissions?: boolean;
    }
  ): Promise<SkillSnapshotUsage> {
    await this.assertReadAccess(d);

    let { limits, ...options } = d.options;
    let sources = (await this.loadSnapshotSources({ skill: d.skill, options }))!;
    let entries = await this.mapSnapshotSources(sources, source =>
      this.snapshotEntry({ skill: d.skill, source, skillName: options.skillName })
    );

    let fileCount = sources.length;
    let size = Math.max(getStoredSnapshotBytes(sources), getServedSnapshotBytes(entries));

    return {
      fileCount,
      size,
      exceededLimits: [
        ...(fileCount > limits.maxFiles ? (['file_count'] as const) : []),
        ...(size > limits.maxBytes ? (['size'] as const) : [])
      ]
    };
  }

  async readSkillSnapshotFile(
    d: SkillSnapshotInput & { path: string }
  ): Promise<SkillSnapshotFileContent | null> {
    await this.assertReadAccess(d);

    let options = d.options ?? {};
    let sources = await this.loadSnapshotSources({ skill: d.skill, options });

    let source = sources?.find(entry => entry.path === d.path);
    if (!source) return null;

    return await this.snapshotSource({
      skill: d.skill,
      source,
      skillName: options.skillName
    });
  }

  async applySkillFileChange(
    d: ApplySkillFileChangesProps & { change: SkillFileChange }
  ): Promise<SkillFileChangeResult> {
    let [result] = await this.applyChangesInOrder({
      ...d,
      changes: [d.change],
      indexErrors: false
    });

    return result!;
  }

  async applySkillFileChanges(
    d: ApplySkillFileChangesProps & { changes: SkillFileChange[] }
  ): Promise<SkillFileChangeResult[]> {
    return await this.applyChangesInOrder({ ...d, indexErrors: true });
  }

  private async applyChangesInOrder(
    d: ApplySkillFileChangesProps & { changes: SkillFileChange[]; indexErrors: boolean }
  ): Promise<SkillFileChangeResult[]> {
    if (!d.changes.length) {
      throw new ServiceError(badRequestError({ message: 'At least one change is required' }));
    }

    if (d.changes.length > maxSkillFileBatchOperations) {
      throw new ServiceError(
        badRequestError({
          message: `A maximum of ${maxSkillFileBatchOperations} skill file changes can be applied at once`
        })
      );
    }

    this.assertSkillActive(d.skill);
    await skillService.assertSkillWriteAccess(d);

    let changes = await this.prepareChanges(d);

    let appliedChanges = await withSkillStoreMutationLock(d.skill.store!.id, async () => {
      let applied: AppliedSkillFileChange[] = [];

      for (let [index, change] of changes.entries()) {
        try {
          applied.push(await this.applyChange({ ...d, change }));
        } catch (error) {
          if (!isServiceError(error) || !d.indexErrors) throw error;

          throw prefixChangeError({ index, error, appliedCount: applied.length });
        }
      }

      return applied;
    });
    await skillService.recordSkillEdit(d);

    return await Promise.all(
      appliedChanges.map(async ({ item, ...change }) => ({
        ...change,
        file: item ? (await this.presentItem({ item, flushLiveEdits: false })).file : null
      }))
    );
  }
}

export let skillFileService = Service.create(
  'cargoSkillFileService',
  () => new SkillFileServiceImpl()
).build();
