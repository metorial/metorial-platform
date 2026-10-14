import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationOutpostsCredentialsListOutput = {
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

export let mapManagementOrganizationOutpostsCredentialsListOutput =
  /* @__PURE__ */ createMapper<ManagementOrganizationOutpostsCredentialsListOutput>(
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

export type ManagementOrganizationOutpostsCredentialsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationOutpostsCredentialsListQuery =
  /* @__PURE__ */ createMapper<ManagementOrganizationOutpostsCredentialsListQuery>(
    0
  );
