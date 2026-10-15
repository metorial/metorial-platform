import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsPluginsGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapDashboardInstanceSkillsPluginsGetEditorUrlOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsPluginsGetEditorUrlOutput>(
    ['expires_at'],
    1
  );

export type DashboardInstanceSkillsPluginsGetEditorUrlBody = {};

export let mapDashboardInstanceSkillsPluginsGetEditorUrlBody =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsPluginsGetEditorUrlBody>(
    0
  );
