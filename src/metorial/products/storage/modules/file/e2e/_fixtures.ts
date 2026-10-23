import { generatePlainId } from '@lowerdeck/id';
import { uniqueEmail, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import {
  createResourceAuthorization,
  type ResourceAuthorization
} from '@metorial/module-access';
import {
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { resourceActorService } from '@metorial/module-resource-actor';
import { storeService } from '@metorial/module-store';
import {
  fileLinkService,
  filePurposeService,
  fileReferenceService,
  fileService,
  getCargoFilesBucketName,
  getStorage
} from '../src';

export let privileged = createResourceAuthorization({ restricted: false });

export let scopeOf = (fixture: OrganizationFixture) => ({
  project: fixture.project,
  instance: fixture.instance
});

export let allByteValues = () => Uint8Array.from({ length: 256 }, (_, index) => index);

export let uploadBytes = async (
  fixture: OrganizationFixture,
  input: {
    content: Uint8Array | string;
    name?: string;
    mimeType?: string;
    purpose?: string;
    authorization?: ResourceAuthorization;
  }
) =>
  await fileService.createUploadedFile({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    purpose: input.purpose ?? 'generic',
    file: new Blob([input.content as BlobPart], {
      type: input.mimeType ?? 'application/octet-stream'
    }),
    input: {
      name: input.name ?? `${uniqueId('upload')}.bin`,
      authorization: input.authorization ?? privileged
    }
  });

export let createWritableFile = async (
  fixture: OrganizationFixture,
  input: {
    content?: string;
    name?: string;
    authorization?: ResourceAuthorization;
    store?: { id: string; path: string; replace?: boolean };
  } = {}
) => {
  let content = input.content ?? uniqueId('writable-content');
  let storeId = generatePlainId(20);
  await getStorage().putObject(getCargoFilesBucketName(), storeId, content, 'text/plain');

  return await fileService.createFile({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    purpose: 'generic',
    storeId,
    input: {
      name: input.name ?? `${uniqueId('writable')}.dat`,
      mimeType: 'text/plain',
      size: Buffer.byteLength(content),
      authorization: input.authorization ?? privileged,
      store: input.store
    }
  });
};

export let linkFile = async (
  fixture: OrganizationFixture,
  file: Parameters<typeof fileLinkService.createFileLink>[0]['file'],
  input: { expiresAt?: Date } = {}
) =>
  await fileLinkService.createFileLink({
    ...scopeOf(fixture),
    file,
    input
  });

export let referenceLink = async (
  fixture: OrganizationFixture,
  fileLink: Awaited<ReturnType<typeof linkFile>>,
  input: { entityType?: string; entityId?: string } = {}
) =>
  await fileReferenceService.upsertFileReference({
    ...scopeOf(fixture),
    fileLink,
    input: {
      entityType: input.entityType ?? 'e2e_entity',
      entityId: input.entityId ?? uniqueId('entity')
    }
  });

export let objectExists = async (storeId: string) =>
  await getStorage()
    .headObject(getCargoFilesBucketName(), storeId)
    .then(() => true)
    .catch(() => false);

export let seedPendingUpload = async (
  fixture: OrganizationFixture,
  input: {
    size: number;
    content?: Uint8Array | string;
    name?: string;
    mimeType?: string;
    expiresAt?: Date;
  }
) => {
  let purpose = await filePurposeService.ensureGenericFilePurpose();
  let storeId = generatePlainId(20);

  if (input.content !== undefined) {
    await getStorage().putObject(
      getCargoFilesBucketName(),
      storeId,
      Buffer.from(input.content),
      input.mimeType ?? 'application/octet-stream'
    );
  }

  return await db.fileUpload.create({
    data: {
      id: await ID.generateId('fileUpload'),
      instanceOid: fixture.instance.oid,
      purposeOid: purpose.oid,
      storeId,
      fileName: input.name ?? `${uniqueId('pending')}.bin`,
      fileSize: input.size,
      fileType: input.mimeType ?? 'application/octet-stream',
      uploadUrlExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      expiresAt: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });
};

export let createConsumer = async (fixture: OrganizationFixture) => {
  let surface = await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: { name: uniqueId('File Surface'), sessionExpiryTimeInSeconds: 3600 }
  });
  let profile = await consumerProfileService.createConsumerProfile({
    surface,
    email: uniqueEmail('file-consumer'),
    name: 'E2E File Consumer',
    auditScope: fixture.auditScope
  });
  let actor = await resourceActorService.ensureConsumerProfileActor({
    project: fixture.project,
    consumerProfile: profile
  });

  return {
    actor,
    authorization: createResourceAuthorization({
      restricted: true,
      resourceActor: actor,
      accessTags: [{ accessTagOid: profile.personalConsumerGroup!.accessTagOid }],
      project: fixture.project,
      instance: fixture.instance,
      consumerProfile: profile
    })
  };
};

export let createStore = async (
  fixture: OrganizationFixture,
  access: 'private' | 'public_read' | 'public_write' = 'private'
) =>
  await storeService.createStore({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: { name: uniqueId('file-store'), access }
  });
