import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Store } from '@metorial-cargo/db';
import { db } from '@metorial-cargo/db';
import {
  documentAuthoritativeWriteService,
  documentService
} from '@metorial-cargo/module-doc';
import { actorService, type CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { storeItemMutationService } from '@metorial-cargo/module-store';
import { skillMergeTargetLock } from '../lib/mergeLock';
import { sameSnapshotItem, type Snapshot, type SnapshotItem } from '../lib/mergeSnapshot';
import {
  skillMergeRequestInclude,
  skillMergeRequestInternalService,
  type SkillMergeRequestItemRecord,
  type SkillMergeRequestRecord
} from './skillMergeRequestInternal';

class SkillMergeRequestApplyInternalServiceImpl {
  private async getTargetItemByPath(d: { store: Pick<Store, 'oid'>; path: string }) {
    return await db.storeItem.findFirst({
      where: {
        storeOid: d.store.oid,
        path: d.path
      },
      include: {
        document: true,
        file: true
      }
    });
  }

  private getResolutionContent(d: { item: SkillMergeRequestItemRecord }) {
    let resolution = d.item.resolution as
      | {
          title?: string;
          content?: string;
          fileId?: string;
        }
      | null
      | undefined;

    return resolution ?? {};
  }

  private getDocumentResolution(d: { item: SkillMergeRequestItemRecord }) {
    let resolution = this.getResolutionContent(d);
    let title =
      resolution.title ??
      d.item.sourceDocumentTitle ??
      d.item.targetDocumentTitle ??
      d.item.baseDocumentTitle ??
      d.item.sourceDocument?.title ??
      d.item.targetDocument?.title ??
      d.item.baseDocument?.title ??
      d.item.path.split('/').filter(Boolean).at(-1) ??
      'Document';
    let content =
      d.item.resolutionType === 'edit_document'
        ? resolution.content
        : d.item.sourceDocumentVersion?.content.content;

    if (content === undefined) {
      throw new ServiceError(
        badRequestError({ message: `Missing document content for ${d.item.path}` })
      );
    }

    return { title, content };
  }

  private async applyDocumentResolution(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      item: SkillMergeRequestItemRecord;
      actorId?: string;
      title: string;
      content: string;
    }
  ) {
    let targetItem = await this.getTargetItemByPath({
      store: d.mergeRequest.targetSkill.store,
      path: d.item.path
    });

    if (targetItem?.document) {
      let document = await documentService.getDocumentById({
        tenant: d.tenant,
        environment: d.environment,
        documentId: targetItem.document.id,
        actorId: d.actorId
      });

      await documentAuthoritativeWriteService.applyDocumentContent({
        tenant: d.tenant,
        environment: d.environment,
        document,
        input: {
          title: d.title,
          content: d.content,
          actorId: d.actorId
        }
      });
      return;
    }

    if (!targetItem) {
      await documentService.createDocument({
        tenant: d.tenant,
        environment: d.environment,
        input: {
          title: d.title,
          content: d.content,
          actorId: d.actorId,
          store: {
            id: d.mergeRequest.targetSkill.store.id,
            path: d.item.path
          }
        }
      });
      return;
    }

    let document = await documentService.createDocument({
      tenant: d.tenant,
      environment: d.environment,
      input: {
        title: d.title,
        content: d.content,
        actorId: d.actorId
      }
    });

    await storeItemMutationService.modifyStoreItems({
      tenant: d.tenant,
      environment: d.environment,
      store: d.mergeRequest.targetSkill.store,
      actor: d.actorId
        ? await actorService.getActorById({ tenant: d.tenant, actorId: d.actorId })
        : undefined,
      operations: [
        {
          type: 'modify',
          itemId: targetItem.id,
          documentId: document.id
        }
      ]
    });
  }

  async applyItemResolution(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      item: SkillMergeRequestItemRecord;
      actorId?: string;
    }
  ) {
    let actor = d.actorId
      ? await actorService.getActorById({
          tenant: d.tenant,
          actorId: d.actorId
        })
      : undefined;
    let resolution = this.getResolutionContent({ item: d.item });
    let resolutionType = d.item.resolutionType;

    if (!resolutionType || resolutionType === 'skip' || resolutionType === 'keep_target')
      return;

    if (resolutionType === 'remove') {
      let targetItem = await this.getTargetItemByPath({
        store: d.mergeRequest.targetSkill.store,
        path: d.item.path
      });
      if (!targetItem) return;

      await storeItemMutationService.modifyStoreItems({
        tenant: d.tenant,
        environment: d.environment,
        store: d.mergeRequest.targetSkill.store,
        actor,
        operations: [
          {
            type: 'remove',
            itemId: targetItem.id
          }
        ]
      });
      return;
    }

    if (resolutionType === 'replace_file' || d.item.kind === 'file') {
      let fileId = resolution.fileId ?? d.item.sourceFile?.id;
      if (!fileId) {
        throw new ServiceError(
          badRequestError({ message: `Missing file for ${d.item.path}` })
        );
      }

      if (resolutionType === 'replace_file') {
        await skillMergeRequestInternalService.assertReadableReplacementFile({
          tenant: d.tenant,
          environment: d.environment,
          mergeRequest: d.mergeRequest,
          actorId: d.actorId,
          fileId
        });
      }

      let targetItem = await this.getTargetItemByPath({
        store: d.mergeRequest.targetSkill.store,
        path: d.item.path
      });

      await storeItemMutationService.modifyStoreItems({
        tenant: d.tenant,
        environment: d.environment,
        store: d.mergeRequest.targetSkill.store,
        actor,
        operations: [
          targetItem
            ? {
                type: 'modify',
                itemId: targetItem.id,
                path: d.item.path,
                fileId
              }
            : {
                type: 'add',
                path: d.item.path,
                fileId
              }
        ]
      });
      return;
    }

    if (d.item.kind === 'directory') {
      if (resolutionType !== 'accept_source') return;

      await storeItemMutationService.modifyStoreItems({
        tenant: d.tenant,
        environment: d.environment,
        store: d.mergeRequest.targetSkill.store,
        actor,
        operations: [
          {
            type: 'add',
            path: d.item.path
          }
        ]
      });
      return;
    }

    let { title, content } = this.getDocumentResolution({ item: d.item });

    await this.applyDocumentResolution({
      tenant: d.tenant,
      environment: d.environment,
      mergeRequest: d.mergeRequest,
      item: d.item,
      actorId: d.actorId,
      title,
      content
    });
  }

  async applyResolvedItems(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      items: SkillMergeRequestItemRecord[];
      actorId?: string;
    }
  ) {
    let items = [...d.items].sort((left, right) => {
      let leftRemovesDirectory = left.resolutionType === 'remove' && left.kind === 'directory';
      let rightRemovesDirectory =
        right.resolutionType === 'remove' && right.kind === 'directory';
      if (leftRemovesDirectory !== rightRemovesDirectory) return leftRemovesDirectory ? 1 : -1;
      if (leftRemovesDirectory && rightRemovesDirectory) {
        return right.path.localeCompare(left.path);
      }

      let leftAddsDirectory =
        left.resolutionType === 'accept_source' && left.kind === 'directory';
      let rightAddsDirectory =
        right.resolutionType === 'accept_source' && right.kind === 'directory';
      if (leftAddsDirectory !== rightAddsDirectory) return leftAddsDirectory ? -1 : 1;
      if (leftAddsDirectory && rightAddsDirectory) return left.path.localeCompare(right.path);

      return left.path.localeCompare(right.path);
    });

    for (let item of items) {
      if (item.status === 'skipped') continue;

      await this.applyItemResolution({
        tenant: d.tenant,
        environment: d.environment,
        mergeRequest: d.mergeRequest,
        item,
        actorId: d.actorId
      });
    }
  }

  async verifyResolvedItems(d: {
    items: SkillMergeRequestItemRecord[];
    before: Snapshot;
    target: Snapshot;
  }) {
    let resolvedPaths = new Set(d.items.map(item => item.path));
    let allPaths = new Set([...d.before.itemsByPath.keys(), ...d.target.itemsByPath.keys()]);

    for (let path of allPaths) {
      if (resolvedPaths.has(path)) continue;
      if (!sameSnapshotItem(d.before.itemsByPath.get(path), d.target.itemsByPath.get(path))) {
        throw new Error(`Merge verification failed for ${path}: unrelated item changed`);
      }
    }

    for (let item of d.items) {
      let actual = d.target.itemsByPath.get(item.path);
      let resolution = this.getResolutionContent({ item });

      if (item.status === 'skipped') {
        if (sameSnapshotItem(d.before.itemsByPath.get(item.path), actual)) continue;
        throw new Error(`Merge verification failed for ${item.path}: skipped item changed`);
      }

      if (item.resolutionType === 'remove') {
        if (!actual) continue;
        throw new Error(`Merge verification failed for ${item.path}: item still exists`);
      }

      if (item.kind === 'directory') {
        if (actual?.kind === 'directory') continue;
        throw new Error(`Merge verification failed for ${item.path}: directory is missing`);
      }

      if (item.kind === 'file') {
        let expectedFileOid: bigint | null | undefined = item.sourceFileOid;
        if (item.resolutionType === 'replace_file') {
          if (!resolution.fileId) {
            throw new Error(`Merge verification failed for ${item.path}: file is missing`);
          }
          expectedFileOid = (
            await db.file.findUnique({
              where: { id: resolution.fileId }
            })
          )?.oid;
        }

        if (expectedFileOid && actual?.kind === 'file' && actual.fileOid === expectedFileOid) {
          continue;
        }
        throw new Error(`Merge verification failed for ${item.path}: file does not match`);
      }

      let expected = this.getDocumentResolution({ item });
      if (
        actual?.kind === 'document' &&
        actual.content === expected.content &&
        actual.documentTitle === expected.title
      ) {
        continue;
      }

      throw new Error(`Merge verification failed for ${item.path}: document does not match`);
    }
  }

  private async restoreSnapshotItem(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      item: SnapshotItem;
      actorId?: string;
    }
  ) {
    let syntheticItem = {
      path: d.item.path,
      kind: d.item.kind,
      sourceFile: d.item.fileId ? { id: d.item.fileId } : null,
      sourceDocument: d.item.documentId
        ? {
            id: d.item.documentId,
            title: d.item.documentTitle ?? d.item.path
          }
        : null,
      sourceDocumentVersion: d.item.content
        ? {
            content: {
              content: d.item.content
            }
          }
        : null,
      targetDocument: null,
      baseDocument: null,
      baseDocumentVersion: null,
      targetDocumentVersion: null,
      resolutionType: d.item.kind === 'document' ? 'edit_document' : 'accept_source',
      resolution:
        d.item.kind === 'document'
          ? {
              title: d.item.documentTitle ?? d.item.path,
              content: d.item.content ?? ''
            }
          : null
    } as SkillMergeRequestItemRecord;

    await this.applyItemResolution({
      tenant: d.tenant,
      environment: d.environment,
      mergeRequest: d.mergeRequest,
      item: syntheticItem,
      actorId: d.actorId
    });
  }

  private async rollbackSkillMergeRequestUnlocked(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
    }
  ) {
    if (
      d.mergeRequest.status !== 'merged' ||
      !d.mergeRequest.preMergeTargetSkillVersionOid ||
      d.mergeRequest.rolledBackAt
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Only unrolled-back merged requests with a pre-merge version can roll back'
        })
      );
    }

    let access = await skillMergeRequestInternalService.assertTargetWrite({
      tenant: d.tenant,
      environment: d.environment,
      mergeRequest: d.mergeRequest,
      actorId: d.actorId
    });
    let preMerge = await skillMergeRequestInternalService.getSkillVersionSnapshot(
      d.mergeRequest.preMergeTargetSkillVersionOid
    );
    let currentVersion = await skillMergeRequestInternalService.flushSkillForMergeSnapshot({
      skill: d.mergeRequest.targetSkill
    });
    let current = await skillMergeRequestInternalService.getSkillVersionSnapshot(
      currentVersion.oid
    );
    let actor = d.actorId
      ? await actorService.getActorById({ tenant: d.tenant, actorId: d.actorId })
      : undefined;

    for (let path of [...current.itemsByPath.keys()].sort().reverse()) {
      if (preMerge.itemsByPath.has(path)) continue;

      let targetItem = await this.getTargetItemByPath({
        store: d.mergeRequest.targetSkill.store,
        path
      });
      if (!targetItem) continue;

      await storeItemMutationService.modifyStoreItems({
        tenant: d.tenant,
        environment: d.environment,
        store: d.mergeRequest.targetSkill.store,
        actor,
        operations: [
          {
            type: 'remove',
            itemId: targetItem.id
          }
        ]
      });
    }

    for (let item of preMerge.itemsByPath.values()) {
      if (sameSnapshotItem(item, current.itemsByPath.get(item.path))) {
        continue;
      }

      await this.restoreSnapshotItem({
        tenant: d.tenant,
        environment: d.environment,
        mergeRequest: d.mergeRequest,
        item,
        actorId: d.actorId
      });
    }

    let rollbackVersion = await skillMergeRequestInternalService.flushSkillForMergeSnapshot({
      skill: d.mergeRequest.targetSkill
    });

    return await db.skillMergeRequest.update({
      where: {
        id: d.mergeRequest.id
      },
      data: {
        rollbackTargetSkillVersionOid: rollbackVersion.oid,
        rolledBackByTenantActorOid: access.actor?.oid,
        rolledBackAt: new Date()
      },
      include: skillMergeRequestInclude
    });
  }

  async rollbackSkillMergeRequest(
    d: CargoTenantEnvironment & {
      mergeRequest: SkillMergeRequestRecord;
      actorId?: string;
    }
  ) {
    return await skillMergeTargetLock.usingLock(
      d.mergeRequest.targetSkill.store.id,
      async () => {
        let mergeRequest = await skillMergeRequestInternalService.getRawSkillMergeRequestById({
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          skillMergeRequestId: d.mergeRequest.id
        });

        return await this.rollbackSkillMergeRequestUnlocked({
          ...d,
          mergeRequest
        });
      }
    );
  }
}

export let skillMergeRequestApplyInternalService = Service.create(
  'cargoSkillMergeRequestApplyInternalService',
  () => new SkillMergeRequestApplyInternalServiceImpl()
).build();
