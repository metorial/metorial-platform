import { mapObject } from '@metorial/util-resource-mapper/compact';

export type CustomProvidersCodeGetCodeEditorTokenOutput = {
  object: 'bucket.editor_token';
  id: string;
  url: string;
  expiresAt: Date;
};

export let mapCustomProvidersCodeGetCodeEditorTokenOutput =
  /* @__PURE__ */ mapObject<CustomProvidersCodeGetCodeEditorTokenOutput>(
    ['expires_at'],
    1
  );
