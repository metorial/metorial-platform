import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  documentAuthoritativeWriteService,
  documentService
} from '@metorial/cargo-module-doc';
import { type ResourceScope } from '@metorial/module-resource-tenant';
import type { ResourceAuthorization } from '@metorial/module-access';
import { storeItemMutationService } from '@metorial/cargo-module-store';
import type { ResourceActor, Store } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { createSkillMergeRequestMergeError } from '../lib/mergeError';
import { skillMergeTargetLock } from '../lib/mergeLock';
import { sameSnapshotItem, type Snapshot, type SnapshotItem } from '../lib/mergeSnapshot';
import { skillMergeRequestEventService } from './skillMergeRequestEvent';
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
        storeOid: d.store!.oid,
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
      throw createSkillMergeRequestMergeError('apply_failed');
    }

    return { title, content };
  }

  private async applyDocumentResolution(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      item: SkillMergeRequestItemRecord;
      actor?: ResourceActor;
      title: string;
      content: string;
    }
  ) {
    let targetItem = await this.getTargetItemByPath({
      store: d.mergeRequest.targetSkill.store!,
      path: d.item.path
    });

    if (targetItem?.document) {
      let document = await documentService.getDocumentById({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        documentId: targetItem.document.id,
        authorization: { type: 'privileged', resourceActor: d.actor }
      });

      await documentAuthoritativeWriteService.applyDocumentContent({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        document,
        input: {
          title: d.title,
          content: d.content,
          authorization: { type: 'privileged', resourceActor: d.actor }
        }
      });
      return;
    }

    if (!targetItem) {
      await documentService.createDocument({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        input: {
          title: d.title,
          content: d.content,
          authorization: { type: 'privileged', resourceActor: d.actor },
          store: {
            id: d.mergeRequest.targetSkill.store!.id,
            path: d.item.path
          }
        }
      });
      return;
    }

    let document = await documentService.createDocument({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      input: {
        title: d.title,
        content: d.content,
        authorization: { type: 'privileged', resourceActor: d.actor }
      }
    });

    await storeItemMutationService.modifyStoreItems({
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      store: d.mergeRequest.targetSkill.store!,
      actor: d.actor,
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
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      item: SkillMergeRequestItemRecord;
      actor?: ResourceActor;
    }
  ) {
    let actor = d.actor;
    let resolution = this.getResolutionContent({ item: d.item });
    let resolutionType = d.item.resolutionType;

    if (!resolutionType || resolutionType === 'skip' || resolutionType === 'keep_target')
      return;

    if (resolutionType === 'remove') {
      let targetItem = await this.getTargetItemByPath({
        store: d.mergeRequest.targetSkill.store!,
        path: d.item.path
      });
      if (!targetItem) return;

      await storeItemMutationService.modifyStoreItems({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        store: d.mergeRequest.targetSkill.store!,
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
        throw createSkillMergeRequestMergeError('apply_failed');
      }

      if (resolutionType === 'replace_file') {
        await skillMergeRequestInternalService.assertReadableReplacementFile({
          resourceTenant: d.resourceTenant!,
          resourceGroup: d.resourceGroup,
          mergeRequest: d.mergeRequest,
          authorization: {
            type: 'privileged',
            resourceActor: d.actor
          },
          fileId
        });
      }

      let targetItem = await this.getTargetItemByPath({
        store: d.mergeRequest.targetSkill.store!,
        path: d.item.path
      });

      await storeItemMutationService.modifyStoreItems({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        store: d.mergeRequest.targetSkill.store!,
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
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        store: d.mergeRequest.targetSkill.store!,
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
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      mergeRequest: d.mergeRequest,
      item: d.item,
      actor: d.actor,
      title,
      content
    });
  }

  async applyResolvedItems(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      items: SkillMergeRequestItemRecord[];
      actor?: ResourceActor;
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
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        mergeRequest: d.mergeRequest,
        item,
        actor: d.actor
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
        throw createSkillMergeRequestMergeError('verification_failed');
      }
    }

    for (let item of d.items) {
      let actual = d.target.itemsByPath.get(item.path);
      let resolution = this.getResolutionContent({ item });

      if (item.status === 'skipped') {
        if (sameSnapshotItem(d.before.itemsByPath.get(item.path), actual)) continue;
        throw createSkillMergeRequestMergeError('verification_failed');
      }

      if (item.resolutionType === 'remove') {
        if (!actual) continue;
        throw createSkillMergeRequestMergeError('verification_failed');
      }

      if (item.kind === 'directory') {
        if (actual?.kind === 'directory') continue;
        throw createSkillMergeRequestMergeError('verification_failed');
      }

      if (item.kind === 'file') {
        let expectedFileOid: bigint | null | undefined = item.sourceFileOid;
        if (item.resolutionType === 'replace_file') {
          if (!resolution.fileId) {
            throw createSkillMergeRequestMergeError('verification_failed');
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
        throw createSkillMergeRequestMergeError('verification_failed');
      }

      let expected = this.getDocumentResolution({ item });
      if (
        actual?.kind === 'document' &&
        actual.content === expected.content &&
        actual.documentTitle === expected.title
      ) {
        continue;
      }

      throw createSkillMergeRequestMergeError('verification_failed');
    }
  }

  private async restoreSnapshotItem(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      item: SnapshotItem;
      actor?: ResourceActor;
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
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      mergeRequest: d.mergeRequest,
      item: syntheticItem,
      actor: d.actor
    });
  }

  private async rollbackSkillMergeRequestUnlocked(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      authorization: ResourceAuthorization;
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
      resourceTenant: d.resourceTenant!,
      resourceGroup: d.resourceGroup,
      mergeRequest: d.mergeRequest,
      authorization: d.authorization
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
    let actor = d.authorization.resourceActor;

    for (let path of [...current.itemsByPath.keys()].sort().reverse()) {
      if (preMerge.itemsByPath.has(path)) continue;

      let targetItem = await this.getTargetItemByPath({
        store: d.mergeRequest.targetSkill.store!,
        path
      });
      if (!targetItem) continue;

      await storeItemMutationService.modifyStoreItems({
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        store: d.mergeRequest.targetSkill.store!,
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
        resourceTenant: d.resourceTenant!,
        resourceGroup: d.resourceGroup,
        mergeRequest: d.mergeRequest,
        item,
        actor
      });
    }

    let rollbackVersion = await skillMergeRequestInternalService.flushSkillForMergeSnapshot({
      skill: d.mergeRequest.targetSkill
    });

    return await withTransaction(async tx => {
      let rolledBack = await tx.skillMergeRequest.update({
        where: {
          id: d.mergeRequest.id
        },
        data: {
          rollbackTargetSkillVersionOid: rollbackVersion.oid,
          rolledBackByResourceActorOid: access.actor?.oid,
          rolledBackAt: new Date()
        },
        include: skillMergeRequestInclude
      });
      await skillMergeRequestEventService.createEvent({
        database: tx,
        mergeRequestOid: d.mergeRequest.oid,
        type: 'rolled_back',
        actorOid: access.actor?.oid
      });
      return rolledBack;
    });
  }

  async rollbackSkillMergeRequest(
    d: ResourceScope & {
      mergeRequest: SkillMergeRequestRecord;
      authorization: ResourceAuthorization;
    }
  ) {
    return await skillMergeTargetLock.usingLock(
      d.mergeRequest.targetSkill.store!.id,
      async () => {
        let mergeRequest = await skillMergeRequestInternalService.getRawSkillMergeRequestById({
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
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
