import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsPluginsGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapDashboardInstanceSkillsPluginsGetEditorUrlOutput =
  mtMap.object<DashboardInstanceSkillsPluginsGetEditorUrlOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type DashboardInstanceSkillsPluginsGetEditorUrlBody = {};

export let mapDashboardInstanceSkillsPluginsGetEditorUrlBody =
  mtMap.object<DashboardInstanceSkillsPluginsGetEditorUrlBody>({});

