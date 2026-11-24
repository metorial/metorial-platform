import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsOutpostsCredentialsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardOrganizationsOutpostsCredentialsListOutput =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOutpostsCredentialsListOutput>(
    [
      7,
      [
        1,
        [
          'outpost_id',
          'envelope_preview',
          'expires_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardOrganizationsOutpostsCredentialsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardOrganizationsOutpostsCredentialsListQuery =
  /* @__PURE__ */ createMapper<DashboardOrganizationsOutpostsCredentialsListQuery>(
    0
  );
