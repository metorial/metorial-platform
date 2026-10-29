import { uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import type { ResourceActor, Store, StoreAccess } from '@metorial/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import {
  accessTagService,
  createResourceAuthorization,
  type ResourceAuthorization,
  type RestrictedResourceActor
} from '@metorial/module-access';
import { documentService } from '@metorial/module-documents';
import { filePurposeService, fileService } from '@metorial/module-file';
import { applyEnabledFlags, defaultFlags, setFlagProvider } from '@metorial/module-flags';
import { resourceActorService } from '@metorial/module-resource-actor';
import { afterEach, beforeEach, expect } from 'vitest';
import { storeItemService, storeService, type StoreItemOperationInput } from '../src';

export let privileged = createResourceAuthorization({ restricted: false });

export let scopeOf = (fixture: OrganizationFixture) => ({
  project: fixture.project,
  instance: fixture.instance
});

export let createStore = async (
  fixture: OrganizationFixture,
  input: { name?: string; access?: StoreAccess; actor?: ResourceActor } = {}
) =>
  await storeService.createStore({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: {
      name: input.name ?? uniqueId('store'),
      access: input.access,
      actor: input.actor
    }
  });

export let createLegacyStore = async (fixture: OrganizationFixture) => {
  let store = await createStore(fixture);

  return await db.store.update({ where: { id: store.id }, data: { pathMode: 'legacy' } });
};

export let modifyItems = async (
  fixture: OrganizationFixture,
  store: Store,
  operations: StoreItemOperationInput[],
  authorization: ResourceAuthorization = privileged
) =>
  await storeService.modifyStoreItems({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    authorization,
    store,
    operations
  });

export let uploadFile = async (
  fixture: OrganizationFixture,
  input: { name?: string; content?: string | Uint8Array<ArrayBuffer>; mimeType?: string } = {}
) => {
  let purpose = await filePurposeService.ensureGenericFilePurpose();
  let name = input.name ?? `${uniqueId('file')}.txt`;

  return await fileService.createUploadedFile({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    purpose: purpose.id,
    file: new Blob([input.content ?? `content of ${name}`], {
      type: input.mimeType ?? 'text/plain'
    }),
    input: {
      name,
      title: name,
      authorization: privileged
    }
  });
};

export let addFile = async (
  fixture: OrganizationFixture,
  store: Store,
  path: string,
  input: { name?: string; content?: string | Uint8Array<ArrayBuffer>; mimeType?: string } = {}
) => {
  let file = await uploadFile(fixture, input);
  let [result] = await modifyItems(fixture, store, [{ type: 'add', path, fileId: file.id }]);

  return { file, item: result!.item };
};

export let createDocument = async (
  fixture: OrganizationFixture,
  input: { title?: string; content: string; store?: { id: string; path: string } }
) =>
  await documentService.createDocument({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: {
      title: input.title ?? uniqueId('doc'),
      content: input.content,
      store: input.store,
      authorization: privileged
    }
  });

export let readItemContent = async (fixture: OrganizationFixture, itemId: string) => {
  let item = await storeItemService.getStoreItemById({
    ...scopeOf(fixture),
    authorization: privileged,
    itemId
  });

  return await fileService.downloadFileContent({ file: item.file! });
};

export let readFileContent = async (fixture: OrganizationFixture, fileId: string) => {
  let file = await fileService.getFileById({
    ...scopeOf(fixture),
    authorization: privileged,
    fileId
  });

  return await fileService.downloadFileContent({ file });
};

export let storePaths = async (storeId: string) =>
  (
    await db.storeItem.findMany({
      where: { store: { id: storeId } },
      select: { path: true }
    })
  )
    .map(item => item.path)
    .sort();

export let expectConsistentItemCount = async (storeId: string) => {
  let store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  let rows = await db.storeItem.count({ where: { storeOid: store.oid } });

  expect(store.itemCount).toBe(rows);

  return store;
};

export let consumerAuthorization = async (fixture: OrganizationFixture) => {
  let accessTag = await accessTagService.createAccessTag({ instance: fixture.instance });
  let actor = await resourceActorService.upsertActor({
    project: fixture.project,
    input: { identifier: uniqueId('e2e-store-consumer'), name: 'E2E store consumer' }
  });

  let authorization: ResourceAuthorization = {
    type: 'restricted',
    resourceActor: actor as RestrictedResourceActor,
    accessTags: [{ accessTagOid: accessTag.oid }]
  };

  return { actor, authorization };
};

let stackFlags = () => applyEnabledFlags(defaultFlags, process.env.METORIAL_ENABLED_FLAGS);

export let useStoreResourceFlags = (enabled: boolean) => {
  beforeEach(() => {
    setFlagProvider(async () => ({
      ...stackFlags(),
      'store-participants-v2': enabled,
      'store-access-v2': enabled
    }));
  });

  afterEach(() => {
    setFlagProvider(async () => stackFlags());
  });
};

export let captureFabric = <K extends keyof FabricEvents>(event: K) => {
  let events: FabricEvents[K][] = [];
  let stop = Fabric.listen(event, data => {
    events.push(data);
  });

  return { events, stop };
};

export let randomBytes = (size: number) => {
  let bytes = new Uint8Array(size);
  for (let offset = 0; offset < size; offset += 65536) {
    crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65536, size)));
  }

  return bytes;
};
