import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsMarketplacesGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapDashboardInstanceSkillsMarketplacesGetEditorUrlOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsMarketplacesGetEditorUrlOutput>(
    ['expires_at'],
    1
  );

export type DashboardInstanceSkillsMarketplacesGetEditorUrlBody = {};

export let mapDashboardInstanceSkillsMarketplacesGetEditorUrlBody =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsMarketplacesGetEditorUrlBody>(
    0
  );
