import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import {
  cargo,
  ensureCargoScope,
  reconcileCargoPurposes,
  resolveCargoScopeDescriptorForFile
} from '../cargo';

let getReconcileFileSnapshot = async (fileId: string) => {
  let file = await db.file.findUnique({
    where: {
      id: fileId
    },
    include: {
      purpose: true,
      links: {
        include: {
          references: true
        }
      }
    }
  });
  if (!file) return null;

  return {
    id: file.id,
    storeId: file.storeId,
    purpose: file.purpose.slug,
    name: file.fileName,
    mimeType: file.fileType,
    size: file.fileSize,
    title: file.title ?? undefined,
    status: file.status,
    links: file.links.map(link => ({
      id: link.id,
      key: link.key,
      expiresAt: link.expiresAt ?? undefined,
      references: link.references.map(reference => ({
        id: reference.id,
        entityType: reference.entityType,
        entityId: reference.entityId
      }))
    }))
  };
};

setTimeout(async () => {
  console.log('Starting cargo file reconciliation...');
  await reconcileCargoPurposes();
  console.log('Enqueueing cargo file reconciliation...');
  await reconcileCargoFilesManyQueue.add({});
}, 10000);

export let reconcileCargoFilesManyQueue = createQueue<{ cursor?: string }>({
  name: 'file/cargo/rec/many',
  workerOpts: {
    concurrency: 5
  }
});

export let reconcileCargoFileSingleQueue = createQueue<{ fileId: string }>({
  name: 'file/cargo/rec/single',
  workerOpts: {
    concurrency: 5
  }
});

export let enqueueCargoFileReconcile = async (fileId: string) => {
  await reconcileCargoFileSingleQueue.add({ fileId });
};

export let reconcileCargoFilesManyQueueProcessor = reconcileCargoFilesManyQueue.process(
  async data => {
    let files = await db.file.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      select: {
        id: true
      },
      take: 100,
      orderBy: {
        id: 'asc'
      }
    });

    if (files.length === 0) return;

    await reconcileCargoFileSingleQueue.addMany(files.map(file => ({ fileId: file.id })));

    await reconcileCargoFilesManyQueue.add({
      cursor: files[files.length - 1]!.id
    });
  }
);

export let reconcileCargoFileSingleQueueProcessor = reconcileCargoFileSingleQueue.process(
  async data => {
    await reconcileCargoPurposes();

    let descriptor = await resolveCargoScopeDescriptorForFile(data.fileId);
    if (!descriptor) return;

    let scope = await ensureCargoScope(descriptor);

    let snapshot = await getReconcileFileSnapshot(data.fileId);
    if (!snapshot) return;

    await cargo.reconcile.files({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      items: [snapshot]
    });
  }
);

export let reconcileCargoProcessors = combineQueueProcessors([
  reconcileCargoFilesManyQueueProcessor,
  reconcileCargoFileSingleQueueProcessor
]);
