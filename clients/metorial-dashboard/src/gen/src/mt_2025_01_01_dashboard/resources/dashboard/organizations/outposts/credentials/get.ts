import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOutpostsCredentialsGetOutput = {
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

export let mapDashboardOrganizationsOutpostsCredentialsGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOutpostsCredentialsGetOutput>(
    [
      'outpost_id',
      'envelope_preview',
      'expires_at',
      'created_at',
      'updated_at'
    ],
    1
  );
