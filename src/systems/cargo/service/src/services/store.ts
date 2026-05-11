import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { posix as pathPosix } from 'node:path';
import type {
  Store,
  StoreAccess,
  StoreCloneType,
  TenantActor
} from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId } from '../id';
import { normalizeStorePath } from '../lib/storePath';
import { storeCleanupManyQueue } from '../queues/storeCleanup';
import { getCargoFilesBucketName, getStorage } from '../storage';
import { documentInclude, documentService } from './document';
import { fileService } from './file';
import { filePurposeService, type CargoTenantEnvironment } from './filePurpose';
import { fileReferenceService } from './fileReference';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission,
  type StoreAccessInput
} from './storeAccess';
import { storeItemInclude, type StoreItemRecord } from './storeItem';
import { storeItemMutationService, type StoreItemOperationInput } from './storeItemMutation';
import { storeTemplateService, type StoreTemplateRecord } from './storeTemplate';
import { storeVersionService } from './storeVersion';

type StoreServiceAccessInput = Omit<StoreAccessInput, 'actorId'> & {
  actor?: TenantActor;
};

class StoreServiceImpl {
  private async getStoreRecord(d: CargoTenantEnvironment & { storeId: string }) {
    return await withTransaction(
      async db => {
        let store = await db.store.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            id: d.storeId
          }
        });

        if (!store) throw new ServiceError(notFoundError('store', d.storeId));

        return store;
      },
      { ifExists: true }
    );
  }

  private assertStoreTemplateCloneScope(
    d: CargoTenantEnvironment & {
      storeTemplate: Pick<StoreTemplateRecord, 'id' | 'tenantOid' | 'environmentOid'>;
    }
  ) {
    if (d.storeTemplate.tenantOid && d.storeTemplate.tenantOid !== d.tenant.oid) {
      throw new ServiceError(
        badRequestError({
          message: `Store template ${d.storeTemplate.id} can only be cloned within its linked tenant`
        })
      );
    }

    if (
      d.storeTemplate.environmentOid &&
      d.storeTemplate.environmentOid !== d.environment.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: `Store template ${d.storeTemplate.id} can only be cloned within its linked environment`
        })
      );
    }
  }

  private getStoreTemplateItemName(path: string) {
    let normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    let name = pathPosix.basename(normalizedPath);

    return name || 'template-item';
  }

  private decodeStoreTemplateItemContent(item: StoreTemplateRecord['items'][number]) {
    if (item.kind === 'directory' || item.content === null || item.encoding === null) {
      throw new ServiceError(
        badRequestError({
          message: `Store template item ${item.id} is missing content`
        })
      );
    }

    return item.encoding === 'base64'
      ? Buffer.from(item.content, 'base64')
      : Buffer.from(item.content, 'utf8');
  }

  private async instantiateStandaloneTemplateItems(
    d: CargoTenantEnvironment & {
      store: Store;
      storeTemplate: StoreTemplateRecord;
      actor?: TenantActor;
    }
  ) {
    let filePurpose = await filePurposeService.ensureGenericFilePurpose();
    let sortedItems = [...d.storeTemplate.items].sort((a, b) => {
      if (a.kind === b.kind) return a.path.localeCompare(b.path);
      if (a.kind === 'directory') return -1;
      if (b.kind === 'directory') return 1;
      return a.path.localeCompare(b.path);
    });

    for (let item of sortedItems) {
      if (item.kind === 'directory') {
        if (item.path === '/') {
          continue;
        }

        await storeItemMutationService.modifyStoreItems({
          tenant: d.tenant,
          environment: d.environment,
          store: d.store,
          operations: [
            {
              type: 'add',
              path: item.path
            }
          ]
        });

        continue;
      }

      let content = this.decodeStoreTemplateItemContent(item);
      let name = this.getStoreTemplateItemName(item.path);

      if (item.kind === 'document') {
        await documentService.createDocument({
          tenant: d.tenant,
          environment: d.environment,
          input: {
            title: name,
            content: content.toString('utf8'),
            actorId: d.actor?.id,
            store: {
              id: d.store.id,
              path: item.path
            }
          }
        });

        continue;
      }

      let fileStoreId = `template_${generatePlainId(20)}`;

      await getStorage().putObject(
        getCargoFilesBucketName(),
        fileStoreId,
        new Blob([content]),
        'application/octet-stream'
      );

      await fileService.createFile({
        tenant: d.tenant,
        environment: d.environment,
        purpose: filePurpose.id,
        storeId: fileStoreId,
        input: {
          name,
          mimeType: 'application/octet-stream',
          size: content.length,
          title: name,
          actorId: d.actor?.id,
          store: {
            id: d.store.id,
            path: item.path
          }
        }
      });
    }
  }

  async createStore(
    d: CargoTenantEnvironment & {
      input: {
        id?: string;
        name: string;
        actor?: TenantActor;
        access?: StoreAccess;
        cloneType?: StoreCloneType;
        parentStore?: Store;
        parentStoreTemplate?: Pick<StoreTemplateRecord, 'oid'>;
      };
    }
  ) {
    if (d.input.cloneType && !d.input.parentStore) {
      throw new ServiceError(
        badRequestError({
          message: 'Store clone type can only be set for cloned stores'
        })
      );
    }

    return await withTransaction(async db => {
      let storeIds = d.input.id ? { oid: getId('store').oid, id: d.input.id } : getId('store');
      let lastEditedAt = new Date();

      let createdStore = await db.store.create({
        data: {
          oid: storeIds.oid,
          id: storeIds.id,
          name: d.input.name,
          access: d.input.access ?? 'private',
          cloneType: d.input.parentStore ? (d.input.cloneType ?? 'sync_until_change') : null,
          itemCount: 0,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          parentStoreOid: d.input.parentStore?.oid,
          parentStoreTemplateOid: d.input.parentStoreTemplate?.oid,
          createdByTenantActorOid: d.input.actor?.oid,
          lastEditedAt
        }
      });

      await storeItemMutationService.ensureStoreRootDirectory({
        tenant: d.tenant,
        environment: d.environment,
        store: createdStore
      });

      if (d.input.actor) {
        await storeAccessService.ensureActorStorePermissions({
          store: createdStore,
          actor: d.input.actor,
          permissions: [storeReadPermission, storeWritePermission]
        });
      }

      return (await db.store.findUnique({
        where: {
          id: createdStore.id
        }
      }))!;
    });
  }

  async createStoreFromTemplate(
    d: CargoTenantEnvironment & {
      input: {
        templateId: string;
        id?: string;
        name: string;
        actor?: TenantActor;
        access?: StoreAccess;
      };
    }
  ) {
    let storeTemplate = await storeTemplateService.getStoreTemplateByIdUnsafe({
      storeTemplateId: d.input.templateId
    });

    this.assertStoreTemplateCloneScope({
      tenant: d.tenant,
      environment: d.environment,
      storeTemplate
    });

    if (storeTemplate.sourceStore?.id) {
      let sourceStore = await this.getStoreRecord({
        tenant: d.tenant,
        environment: d.environment,
        storeId: storeTemplate.sourceStore.id
      });

      return await this.cloneStore({
        tenant: d.tenant,
        environment: d.environment,
        store: sourceStore,
        actor: d.input.actor,
        input: {
          id: d.input.id,
          name: d.input.name,
          access: d.input.access,
          cloneType: 'duplicate',
          parentStoreTemplate: storeTemplate
        }
      });
    }

    let createdStore = await this.createStore({
      tenant: d.tenant,
      environment: d.environment,
      input: {
        id: d.input.id,
        name: d.input.name,
        access: d.input.access,
        actor: d.input.actor,
        parentStoreTemplate: storeTemplate
      }
    });

    await this.instantiateStandaloneTemplateItems({
      tenant: d.tenant,
      environment: d.environment,
      store: createdStore,
      storeTemplate,
      actor: d.input.actor
    });

    return (await db.store.findUnique({
      where: {
        id: createdStore.id
      }
    }))!;
  }

  async listStores(d: CargoTenantEnvironment & StoreServiceAccessInput) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let accessibleStoreOids = d.actor
          ? (
              await storeAccessService.listAccessibleStoreOidsForTenantEnvironment({
                tenant: d.tenant,
                environment: d.environment,
                actorId: d.actor.id,
                defaultPermissions: d.defaultPermissions,
                overridePermissions: d.overridePermissions,
                requiredPermission: storeReadPermission
              })
            ).accessibleStoreOids
          : undefined;

        return await db.store.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            oid: accessibleStoreOids
              ? {
                  in: accessibleStoreOids
                }
              : undefined
          }
        });
      })
    );
  }

  async getStoreById(
    d: CargoTenantEnvironment &
      StoreServiceAccessInput & {
        storeId: string;
      }
  ) {
    let store = await this.getStoreRecord(d);
    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store,
      actorId: d.actor?.id,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return store;
  }

  async getStorePermissions(
    d: CargoTenantEnvironment &
      StoreServiceAccessInput & {
        store: Pick<Store, 'oid' | 'id'>;
      }
  ) {
    return await storeAccessService.getStorePermissions({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      actorId: d.actor?.id,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions
    });
  }

  async updateStore(
    d: CargoTenantEnvironment &
      StoreServiceAccessInput & {
        store: Store;
        input: {
          name?: string;
          access?: StoreAccess;
        };
      }
  ) {
    if (d.input.name === undefined && d.input.access === undefined) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one store field must be updated'
        })
      );
    }

    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      actorId: d.actor?.id,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    return await withTransaction(async db => {
      let lastEditedAt = new Date();

      await db.store.update({
        where: {
          id: d.store.id
        },
        data: {
          name: d.input.name,
          access: d.input.access
        }
      });

      await storeVersionService.touchStoreLastEditedAt({
        storeOid: d.store.oid,
        at: lastEditedAt
      });

      return (await db.store.findUnique({
        where: {
          id: d.store.id
        }
      }))!;
    });
  }

  async cloneStore(
    d: CargoTenantEnvironment &
      StoreServiceAccessInput & {
        store: Store;
        input: {
          id?: string;
          name?: string;
          access?: StoreAccess;
          cloneType?: StoreCloneType;
          parentStoreTemplate?: Pick<StoreTemplateRecord, 'oid'>;
        };
      }
  ) {
    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      actorId: d.actor?.id,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });

    return await withTransaction(async db => {
      let cloneType = d.input.cloneType ?? 'sync_until_change';
      let clonedStore = await this.createStore({
        tenant: d.tenant,
        environment: d.environment,
        input: {
          id: d.input.id,
          name: d.input.name ?? d.store.name,
          access: d.input.access ?? d.store.access,
          actor: d.actor,
          cloneType,
          parentStore: d.store,
          parentStoreTemplate: d.input.parentStoreTemplate
        }
      });

      let items = await db.storeItem.findMany({
        where: {
          storeOid: d.store.oid
        },
        include: storeItemInclude,
        orderBy: {
          createdAt: 'asc'
        }
      });

      for (let item of items) {
        await this.cloneStoreItemIntoStore({
          tenant: d.tenant,
          environment: d.environment,
          targetStore: clonedStore,
          item,
          actor: d.actor,
          defaultPermissions: d.defaultPermissions,
          overridePermissions: d.overridePermissions,
          cloneType
        });
      }

      await storeVersionService.markStoreDirtyIfNeeded({
        storeOid: clonedStore.oid
      });

      return (await db.store.findUnique({
        where: {
          id: clonedStore.id
        }
      }))!;
    });
  }

  async deleteStore(
    d: CargoTenantEnvironment &
      StoreServiceAccessInput & {
        store: Store;
        allowLinkedSkillDelete?: boolean;
        allowLinkedStoreTemplateDelete?: boolean;
      }
  ) {
    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      actorId: d.actor?.id,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    if (!d.allowLinkedSkillDelete) {
      let linkedSkill = await db.skill.findFirst({
        where: {
          storeOid: d.store.oid
        },
        select: {
          id: true
        }
      });

      if (linkedSkill) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete store: it is linked to a skill'
          })
        );
      }
    }

    if (!d.allowLinkedStoreTemplateDelete) {
      let linkedStoreTemplate = d.store.parentStoreTemplateOid
        ? { id: d.store.id }
        : await db.storeTemplate.findFirst({
            where: {
              sourceStoreOid: d.store.oid
            },
            select: {
              id: true
            }
          });

      if (linkedStoreTemplate) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete store: it is linked to a store template'
          })
        );
      }
    }

    let { deletedStore, fileReferenceIds } = await withTransaction(async db => {
      let items = await db.storeItem.findMany({
        where: {
          storeOid: d.store.oid
        },
        select: {
          reference: {
            select: {
              id: true
            }
          }
        }
      });

      let deletedStore = await db.store.delete({
        where: {
          id: d.store.id
        }
      });

      return {
        deletedStore,
        fileReferenceIds: items
          .map(item => item.reference?.id)
          .filter((id): id is string => !!id)
      };
    });

    if (fileReferenceIds.length > 0) {
      await storeCleanupManyQueue.add({
        fileReferenceIds
      });
    }

    return deletedStore;
  }

  async cleanupStoreFileReference(d: { fileReferenceId: string }) {
    await fileReferenceService.deleteFileReferenceByIdAndCleanup({
      fileReferenceId: d.fileReferenceId
    });
  }

  async modifyStoreItems(
    d: CargoTenantEnvironment &
      StoreServiceAccessInput & {
        store: Store;
        operations: StoreItemOperationInput[];
      }
  ) {
    await storeAccessService.assertStoreAccessForStore({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      actorId: d.actor?.id,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeWritePermission
    });

    return await storeItemMutationService.modifyStoreItems({
      tenant: d.tenant,
      environment: d.environment,
      store: d.store,
      operations: d.operations,
      actor: d.actor
    });
  }

  private async cloneStoreItemIntoStore(
    d: CargoTenantEnvironment &
      StoreServiceAccessInput & {
        targetStore: Store;
        item: StoreItemRecord;
        cloneType: StoreCloneType;
      }
  ) {
    return await withTransaction(async db => {
      let normalizedItemPath = normalizeStorePath({
        path: d.item.path,
        kind: d.item.kind === 'directory' ? 'directory' : 'file'
      });

      if (d.item.kind === 'directory') {
        if (normalizedItemPath.path === '/') {
          return;
        }

        let sourceDirectory = await db.storeDirectory.findFirst({
          where: {
            storeOid: d.item.storeOid,
            path: normalizedItemPath.path
          }
        });

        if (sourceDirectory && !sourceDirectory.isAutoCreated) {
          await storeItemMutationService.modifyStoreItems({
            tenant: d.tenant,
            environment: d.environment,
            store: d.targetStore,
            operations: [
              {
                type: 'add',
                path: normalizedItemPath.path
              }
            ],
            actor: d.actor
          });
        }

        return;
      }

      if (d.item.document) {
        let sourceDocument = await db.document.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            id: d.item.document.id
          },
          include: documentInclude
        });

        if (!sourceDocument) {
          throw new ServiceError(notFoundError('document', d.item.document.id));
        }

        let clonedDocument = await documentService.cloneDocument({
          tenant: d.tenant,
          environment: d.environment,
          document: sourceDocument,
          input: {
            cloneType: d.cloneType,
            actorId: d.actor?.id,
            creatorActorId: d.actor?.id
          }
        });

        await storeItemMutationService.attachTargetToStore({
          tenant: d.tenant,
          environment: d.environment,
          store: d.targetStore,
          path: normalizedItemPath.path,
          target: {
            file: clonedDocument.file,
            document: {
              oid: clonedDocument.oid,
              id: clonedDocument.id
            }
          },
          actor: d.actor
        });

        return;
      }

      if (!d.item.file) {
        throw new ServiceError(notFoundError('file', d.item.id));
      }

      await storeItemMutationService.attachTargetToStore({
        tenant: d.tenant,
        environment: d.environment,
        store: d.targetStore,
        path: normalizedItemPath.path,
        target: {
          file: d.item.file,
          document: null
        },
        actor: d.actor
      });
    });
  }
}

export let storeService = Service.create(
  'cargoStoreService',
  () => new StoreServiceImpl()
).build();
