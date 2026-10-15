import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SkillsPluginsGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapSkillsPluginsGetEditorUrlOutput =
  /* @__PURE__ */ mapObject<SkillsPluginsGetEditorUrlOutput>(['expires_at'], 1);

export type SkillsPluginsGetEditorUrlBody = {};

export let mapSkillsPluginsGetEditorUrlBody =
  /* @__PURE__ */ createMapper<SkillsPluginsGetEditorUrlBody>(0);
