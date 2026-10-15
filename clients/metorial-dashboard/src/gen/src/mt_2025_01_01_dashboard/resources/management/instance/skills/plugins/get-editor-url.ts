import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsPluginsGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapManagementInstanceSkillsPluginsGetEditorUrlOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsPluginsGetEditorUrlOutput>(
    ['expires_at'],
    1
  );

export type ManagementInstanceSkillsPluginsGetEditorUrlBody = {};

export let mapManagementInstanceSkillsPluginsGetEditorUrlBody =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsPluginsGetEditorUrlBody>(
    0
  );
