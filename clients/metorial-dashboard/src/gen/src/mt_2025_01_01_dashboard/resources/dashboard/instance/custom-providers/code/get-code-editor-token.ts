import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapDashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceCustomProvidersCodeGetCodeEditorTokenOutput>(
    ['expires_at'],
    1
  );
