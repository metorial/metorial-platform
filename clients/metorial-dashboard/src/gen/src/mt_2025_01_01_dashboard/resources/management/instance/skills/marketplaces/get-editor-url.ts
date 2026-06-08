import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsMarketplacesGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapManagementInstanceSkillsMarketplacesGetEditorUrlOutput =
  mtMap.object<ManagementInstanceSkillsMarketplacesGetEditorUrlOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type ManagementInstanceSkillsMarketplacesGetEditorUrlBody = {};

export let mapManagementInstanceSkillsMarketplacesGetEditorUrlBody =
  mtMap.object<ManagementInstanceSkillsMarketplacesGetEditorUrlBody>({});

