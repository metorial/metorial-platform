import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsMarketplacesGetEditorUrlOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapSkillsMarketplacesGetEditorUrlOutput =
  mtMap.object<SkillsMarketplacesGetEditorUrlOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type SkillsMarketplacesGetEditorUrlBody = {};

export let mapSkillsMarketplacesGetEditorUrlBody =
  mtMap.object<SkillsMarketplacesGetEditorUrlBody>({});

