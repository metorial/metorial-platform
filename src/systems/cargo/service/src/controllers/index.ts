import { createServer, type InferClient } from '@lowerdeck/rpc-server';
import { app } from './_app';
import { environmentController } from './environment';
import { fileController } from './file';
import { fileLinkController } from './fileLink';
import { filePurposeController } from './filePurpose';
import { fileReferenceController } from './fileReference';
import { reconcileController } from './reconcile';
import { tenantController } from './tenant';

export let rootController = app.controller({
  tenant: tenantController,
  environment: environmentController,
  filePurpose: filePurposeController,
  file: fileController,
  fileLink: fileLinkController,
  fileReference: fileReferenceController,
  reconcile: reconcileController
});

export let CargoRPC = createServer({})(rootController);

export type CargoClient = InferClient<typeof rootController>;
