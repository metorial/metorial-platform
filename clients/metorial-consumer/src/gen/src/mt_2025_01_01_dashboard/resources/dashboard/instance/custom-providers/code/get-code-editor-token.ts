import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapDashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput =
  mtMap.object<DashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

