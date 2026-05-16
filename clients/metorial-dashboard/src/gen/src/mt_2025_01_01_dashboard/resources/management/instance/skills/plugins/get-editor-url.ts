import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsPluginsGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapManagementInstanceSkillsPluginsGetEditorUrlOutput =
  mtMap.object<ManagementInstanceSkillsPluginsGetEditorUrlOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type ManagementInstanceSkillsPluginsGetEditorUrlBody = {};

export let mapManagementInstanceSkillsPluginsGetEditorUrlBody =
  mtMap.object<ManagementInstanceSkillsPluginsGetEditorUrlBody>({});

