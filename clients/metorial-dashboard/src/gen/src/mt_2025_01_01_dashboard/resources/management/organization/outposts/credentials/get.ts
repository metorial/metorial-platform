import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOutpostsCredentialsGetOutput = {
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

export let mapManagementOrganizationOutpostsCredentialsGetOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationOutpostsCredentialsGetOutput>(
    [
      'outpost_id',
      'envelope_preview',
      'expires_at',
      'created_at',
      'updated_at'
    ],
    1
  );
