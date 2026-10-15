import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsMarketplacesGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapManagementInstanceSkillsMarketplacesGetEditorUrlOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsMarketplacesGetEditorUrlOutput>(
    ['expires_at'],
    1
  );

export type ManagementInstanceSkillsMarketplacesGetEditorUrlBody = {};

export let mapManagementInstanceSkillsMarketplacesGetEditorUrlBody =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsMarketplacesGetEditorUrlBody>(
    0
  );
