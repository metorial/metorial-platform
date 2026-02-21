import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomProvidersCodeGetCodeEditorTokenOutput = {
  object: 'custom_server.code_editor_token';
  id: string;
  token: string;
  expiresAt: string;
};

export let mapManagementInstanceCustomProvidersCodeGetCodeEditorTokenOutput =
  mtMap.object<ManagementInstanceCustomProvidersCodeGetCodeEditorTokenOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    token: mtMap.objectField('token', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.passthrough())
  });

