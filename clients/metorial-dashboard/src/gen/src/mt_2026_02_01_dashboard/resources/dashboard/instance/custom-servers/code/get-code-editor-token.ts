import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomServersCodeGetCodeEditorTokenOutput = {
  object: 'custom_server.code_editor_token';
  id: string;
  token: string;
  expiresAt: Date;
};

export let mapDashboardInstanceCustomServersCodeGetCodeEditorTokenOutput =
  mtMap.object<DashboardInstanceCustomServersCodeGetCodeEditorTokenOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    token: mtMap.objectField('token', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

