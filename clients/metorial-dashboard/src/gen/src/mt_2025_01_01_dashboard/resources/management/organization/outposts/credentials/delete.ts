import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationOutpostsCredentialsDeleteOutput = {
  object: 'outpost_credential';
  id: string;
  status: 'active' | 'disabled' | 'deleted' | 'expired';
  outpostId: string;
  name: string;
  envelopePreview: string;
  envelope: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationOutpostsCredentialsDeleteOutput =
  mtMap.object<ManagementOrganizationOutpostsCredentialsDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    outpostId: mtMap.objectField('outpost_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    envelopePreview: mtMap.objectField('envelope_preview', mtMap.passthrough()),
    envelope: mtMap.objectField('envelope', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

