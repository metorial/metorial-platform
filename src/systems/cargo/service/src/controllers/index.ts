import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { actorController } from './actor';
import { documentController } from './document';
import { documentParticipantController } from './documentParticipant';
import { documentVersionController } from './documentVersion';
import { environmentController } from './environment';
import { fileController } from './file';
import { fileLinkController } from './fileLink';
import { filePurposeController } from './filePurpose';
import { fileReferenceController } from './fileReference';
import { reconcileController } from './reconcile';
import { skillController } from './skill';
import { storeController } from './store';
import { storeItemController } from './storeItem';
import { storeParticipantController } from './storeParticipant';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,
  environment: environmentController,
  actor: actorController,
  filePurpose: filePurposeController,
  file: fileController,
  fileLink: fileLinkController,
  fileReference: fileReferenceController,
  skill: skillController,
  store: storeController,
  storeItem: storeItemController,
  storeParticipant: storeParticipantController,
  document: documentController,
  documentVersion: documentVersionController,
  documentParticipant: documentParticipantController,
  reconcile: reconcileController
});

export let CargoRPC = createServer({})(rootController);

export type CargoClient = InferClient<typeof rootController>;
