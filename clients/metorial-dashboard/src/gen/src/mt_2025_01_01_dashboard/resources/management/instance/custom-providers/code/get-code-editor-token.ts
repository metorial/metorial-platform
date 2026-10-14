import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCustomProvidersCodeGetCodeEditorTokenOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapManagementInstanceCustomProvidersCodeGetCodeEditorTokenOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceCustomProvidersCodeGetCodeEditorTokenOutput>(
    ['expires_at'],
    1
  );
