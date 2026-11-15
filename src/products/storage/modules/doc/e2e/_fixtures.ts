import { uniqueEmail, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import type { ResourceActor, StoreAccess, StoreCloneType } from '@metorial/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
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
import { Buffer } from 'node:buffer';
import * as Y from 'yjs';
import { documentService, flushDocumentDraft, type ResolvedDocumentRecord } from '../src';

export let privileged = createResourceAuthorization({ restricted: false });

export let scopeOf = (fixture: OrganizationFixture) => ({
  project: fixture.project,
  instance: fixture.instance
});

export let byteSize = (content: string) => new TextEncoder().encode(content).length;

export let effectiveStoreIdOf = (document: { file: object }) =>
  'effectiveStoreId' in document.file ? document.file.effectiveStoreId : undefined;

export let ensureOrganizationResourceActor = async (fixture: OrganizationFixture) =>
  await resourceActorService.ensureOrganizationActor({
    project: fixture.project,
    organizationActorOid: fixture.actor.oid
  });

export let actorAuthorization = (resourceActor: ResourceActor) =>
  createResourceAuthorization({ restricted: false, resourceActor });

export let createConsumer = async (fixture: OrganizationFixture) => {
  let surface = await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: { name: uniqueId('Documents Surface'), sessionExpiryTimeInSeconds: 3600 }
  });
  let profile = await consumerProfileService.createConsumerProfile({
    surface,
    email: uniqueEmail('doc-consumer'),
    name: 'E2E Document Consumer',
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

export let createStore = async (fixture: OrganizationFixture, access?: StoreAccess) => {
  let store = await storeService.createStore({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: { name: uniqueId('doc-store') }
  });
  if (!access) return store;

  return await db.store.update({ where: { id: store.id }, data: { access } });
};

export let setStoreAccess = async (store: { id: string }, access: StoreAccess) => {
  await db.store.update({ where: { id: store.id }, data: { access } });
};

export let createDocument = async (
  fixture: OrganizationFixture,
  input: {
    id?: string;
    title?: string;
    content?: string;
    authorization?: ResourceAuthorization;
    store?: { id: string };
    readOnly?: boolean;
    templateBacking?: boolean;
  } = {}
) => {
  let title = input.title ?? uniqueId('doc');

  return await documentService.createDocument({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    internal:
      input.readOnly || input.templateBacking
        ? { isReadOnly: input.readOnly, isTemplateBacking: input.templateBacking }
        : undefined,
    input: {
      id: input.id,
      title,
      content: input.content ?? `# ${title}\n\nFirst draft`,
      authorization: input.authorization ?? privileged,
      store: input.store ? { id: input.store.id, path: `/${uniqueId('doc')}.md` } : undefined
    }
  });
};

export let getDocument = async (
  fixture: OrganizationFixture,
  documentId: string,
  authorization: ResourceAuthorization = privileged
) =>
  await documentService.getDocumentById({
    ...scopeOf(fixture),
    documentId,
    authorization
  });

export let editDocument = async (
  fixture: OrganizationFixture,
  document: { id: string },
  input: { title?: string; content?: string; authorization?: ResourceAuthorization }
) =>
  await documentService.updateDocument({
    ...scopeOf(fixture),
    document: await getDocument(fixture, document.id),
    input: {
      title: input.title,
      content: input.content,
      authorization: input.authorization ?? privileged,
      context: fixture.context
    }
  });

export let editAndFlush = async (
  fixture: OrganizationFixture,
  document: { id: string },
  input: { title?: string; content?: string; authorization?: ResourceAuthorization }
) => {
  await editDocument(fixture, document, input);
  await flushDocumentDraft({ documentId: document.id, force: true });

  return await getDocument(fixture, document.id);
};

export let expireVersionWindow = async (document: { id: string }) => {
  let expiredAt = new Date(Date.now() - 60_000);
  await db.document.update({
    where: { id: document.id },
    data: { draftVersionExpiresAt: expiredAt }
  });

  return expiredAt;
};

export let cloneDocument = async (
  fixture: OrganizationFixture,
  document: ResolvedDocumentRecord,
  input: {
    cloneType?: StoreCloneType;
    title?: string;
    rewriteContentTitle?: boolean;
    authorization?: ResourceAuthorization;
  } = {}
) =>
  await documentService.cloneDocument({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    document,
    input: {
      cloneType: input.cloneType,
      title: input.title,
      rewriteContentTitle: input.rewriteContentTitle,
      authorization: input.authorization ?? privileged
    }
  });

export let listVersions = async (document: { oid: bigint }) =>
  await db.documentVersion.findMany({
    where: { documentOid: document.oid },
    include: { content: true },
    orderBy: { versionNumber: 'asc' }
  });

export let captureFabric = <K extends keyof FabricEvents>(event: K) => {
  let events: FabricEvents[K][] = [];
  let stop = Fabric.listen(event, data => {
    events.push(data);
  });

  return { events, stop };
};

export let yjsUpdate = (d: { paragraphs: string[]; title?: string }) => {
  let doc = new Y.Doc();
  doc.transact(() => {
    let body = doc.getXmlFragment('body');
    body.insert(
      0,
      d.paragraphs.map(() => new Y.XmlElement('paragraph'))
    );
    d.paragraphs.forEach((text, index) => {
      let paragraph = body.get(index) as Y.XmlElement;
      paragraph.insert(0, [new Y.XmlText(text)]);
    });
    if (d.title) doc.getMap('meta').set('title', d.title);
  });

  let update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
  doc.destroy();

  return update;
};
