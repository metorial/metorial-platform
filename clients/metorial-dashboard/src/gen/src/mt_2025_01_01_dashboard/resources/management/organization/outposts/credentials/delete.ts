import { mapObject } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<ManagementOrganizationOutpostsCredentialsDeleteOutput>(
    [
      'outpost_id',
      'envelope_preview',
      'expires_at',
      'created_at',
      'updated_at'
    ],
    1
  );
