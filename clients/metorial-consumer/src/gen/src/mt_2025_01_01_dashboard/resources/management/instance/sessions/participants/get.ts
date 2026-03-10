import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsParticipantsGetOutput = {
  object: 'session.participant';
  id: string;
  type: string;
  identifier: string;
  name: string;
  data: Record<string, any>;
  providerId: string | null;
  createdAt: Date;
};

export let mapManagementInstanceSessionsParticipantsGetOutput =
  mtMap.object<ManagementInstanceSessionsParticipantsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    data: mtMap.objectField('data', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

