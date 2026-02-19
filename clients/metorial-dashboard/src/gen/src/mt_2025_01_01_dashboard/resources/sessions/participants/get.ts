import { mtMap } from '@metorial/util-resource-mapper';

export type SessionsParticipantsGetOutput = {
  object: 'session.participant';
  id: string;
  type: string | null;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapSessionsParticipantsGetOutput = mtMap.object<SessionsParticipantsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  type: mtMap.objectField('type', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
  sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});
