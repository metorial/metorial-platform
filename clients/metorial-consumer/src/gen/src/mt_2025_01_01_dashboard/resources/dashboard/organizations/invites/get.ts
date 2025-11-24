import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsInvitesGetOutput = {
  object: 'organization.invite';
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'deleted';
  role: 'member' | 'admin';
  type: 'link' | 'email';
  email: string;
  organization: {
    object: 'organization';
    id: string;
    status: 'active' | 'deleted';
    type: 'default';
    slug: string;
    name: string;
    organizationId: string;
    imageUrl: string;
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
  deletedAt: Date;
  expiresAt: Date;
  acceptedAt: Date;
  rejectedAt: Date;
};

export let mapDashboardOrganizationsInvitesGetOutput =
  mtMap.object<DashboardOrganizationsInvitesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    role: mtMap.objectField('role', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    email: mtMap.objectField('email', mtMap.passthrough()),
    organization: mtMap.objectField(
      'organization',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        organizationId: mtMap.objectField(
          'organization_id',
          mtMap.passthrough()
        ),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    invitedBy: mtMap.objectField(
      'invited_by',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        organizationId: mtMap.objectField(
          'organization_id',
          mtMap.passthrough()
        ),
        name: mtMap.objectField('name', mtMap.passthrough()),
        email: mtMap.objectField('email', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
        teams: mtMap.objectField(
          'teams',
          mtMap.array(
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              assignmentId: mtMap.objectField(
                'assignment_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          )
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    inviteLink: mtMap.objectField(
      'invite_link',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        key: mtMap.objectField('key', mtMap.passthrough()),
        keyRedacted: mtMap.objectField('key_redacted', mtMap.passthrough()),
        url: mtMap.objectField('url', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date()),
    acceptedAt: mtMap.objectField('accepted_at', mtMap.date()),
    rejectedAt: mtMap.objectField('rejected_at', mtMap.date())
  });

