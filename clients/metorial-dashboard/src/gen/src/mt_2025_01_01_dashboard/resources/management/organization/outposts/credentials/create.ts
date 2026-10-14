import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOutpostsCredentialsCreateOutput = {
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

export let mapManagementOrganizationOutpostsCredentialsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationOutpostsCredentialsCreateOutput>(
    [
      'outpost_id',
      'envelope_preview',
      'expires_at',
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementOrganizationOutpostsCredentialsCreateBody = {
  name: string;
  expiresAt?: Date | undefined;
};

export let mapManagementOrganizationOutpostsCredentialsCreateBody =
  /* @__PURE__ */ mapObject<ManagementOrganizationOutpostsCredentialsCreateBody>(
    ['expires_at'],
    1
  );
