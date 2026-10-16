import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementOrganizationInvitesEnsureLinkOutput = {
  object: 'organization.invite';
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'deleted';
  role: 'member' | 'admin';
  type: 'link' | 'email';
  email: string;
  inviteLink: {
    object: 'organization.invite.link';
    id: string;
    key: string | null;
    keyRedacted: string;
    url: string | null;
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  acceptedAt: Date;
  rejectedAt: Date;
  deletedAt: Date;
  organization: {
    object: 'organization';
    id: string;
    type: 'default';
    slug: string;
    name: string;
    imageUrl: string;
    magicMcpOrigin: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  invitedBy: {
    object: 'organization.actor';
    id: string;
    type: 'member' | 'machine_access';
    organizationId: string;
    name: string;
    email: string | null;
    imageUrl: string;
    member: {
      object: 'organization.member#preview';
      id: string;
      status: 'active' | 'deleted';
      role: 'member' | 'admin';
    } | null;
    teams: {
      id: string;
      name: string;
      slug: string;
      assignmentId: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
  };
};

export let mapManagementOrganizationInvitesEnsureLinkOutput =
  /* @__PURE__ */ mapObject<ManagementOrganizationInvitesEnsureLinkOutput>(
    [
      ['invite_link', 1, [1, ['key_redacted', 'created_at']]],
      'created_at',
      'updated_at',
      'expires_at',
      'accepted_at',
      'rejected_at',
      'deleted_at',
      [
        'organization',
        0,
        [1, ['image_url', 'magic_mcp_origin', 'created_at', 'updated_at']]
      ],
      [
        'invited_by',
        1,
        [
          1,
          [
            'organization_id',
            'image_url',
            [
              'teams',
              0,
              [2, [1, ['assignment_id', 'created_at', 'updated_at']]]
            ],
            'created_at',
            'updated_at'
          ]
        ]
      ]
    ],
    1
  );
