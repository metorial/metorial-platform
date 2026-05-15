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
import { skillAgentController } from './skillAgent';
import { skillConfigurationController } from './skillConfiguration';
import { skillMarketplaceController } from './skillMarketplace';
import { skillMarketplacePluginController } from './skillMarketplacePlugin';
import { skillParticipantController } from './skillParticipant';
import { skillPluginController } from './skillPlugin';
import { skillPluginSkillController } from './skillPluginSkill';
import { skillTemplateController } from './skillTemplate';
import { skillVersionController } from './skillVersion';
import { storeController } from './store';
import { storeItemController } from './storeItem';
import { storeParticipantController } from './storeParticipant';
import { storeTemplateController } from './storeTemplate';
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
  skillAgent: skillAgentController,
  skillConfiguration: skillConfigurationController,
  skillMarketplace: skillMarketplaceController,
  skillMarketplacePlugin: skillMarketplacePluginController,
  skillParticipant: skillParticipantController,
  skillPlugin: skillPluginController,
  skillPluginSkill: skillPluginSkillController,
  skillTemplate: skillTemplateController,
  skillVersion: skillVersionController,
  store: storeController,
  storeItem: storeItemController,
  storeParticipant: storeParticipantController,
  storeTemplate: storeTemplateController,
  document: documentController,
  documentVersion: documentVersionController,
  documentParticipant: documentParticipantController,
  reconcile: reconcileController
});

export let CargoRPC = createServer({})(rootController);

export type CargoClient = InferClient<typeof rootController>;
