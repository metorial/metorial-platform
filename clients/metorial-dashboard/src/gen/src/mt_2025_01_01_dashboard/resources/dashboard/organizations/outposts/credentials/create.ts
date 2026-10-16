import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOutpostsCredentialsCreateOutput = {
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

export let mapDashboardOrganizationsOutpostsCredentialsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOutpostsCredentialsCreateOutput>(
    [
      'outpost_id',
      'envelope_preview',
      'expires_at',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardOrganizationsOutpostsCredentialsCreateBody = {
  name: string;
  expiresAt?: Date | undefined;
};

export let mapDashboardOrganizationsOutpostsCredentialsCreateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsOutpostsCredentialsCreateBody>(
    ['expires_at'],
    1
  );
