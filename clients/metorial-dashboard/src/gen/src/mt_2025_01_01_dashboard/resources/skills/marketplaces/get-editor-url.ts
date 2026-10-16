import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SkillsMarketplacesGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapSkillsMarketplacesGetEditorUrlOutput =
  /* @__PURE__ */ mapObject<SkillsMarketplacesGetEditorUrlOutput>(
    ['expires_at'],
    1
  );

export type SkillsMarketplacesGetEditorUrlBody = {};

export let mapSkillsMarketplacesGetEditorUrlBody =
  /* @__PURE__ */ createMapper<SkillsMarketplacesGetEditorUrlBody>(0);
