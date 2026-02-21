import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionErrorGroupsGetOutput = {
  object: 'session.error_group';
  id: string;
  type: string | null;
  name: string | null;
  message: string | null;
  count: number;
  metadata: Record<string, any> | null;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSessionErrorGroupsGetOutput =
  mtMap.object<ManagementInstanceSessionErrorGroupsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    count: mtMap.objectField('count', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

