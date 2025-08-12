import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { organizationInviteType } from '../types';
import { v1OrganizationPresenter } from './organization';
import { v1OrganizationActorPresenter } from './organizationActor';

export let v1OrganizationInvitePresenter = Presenter.create(organizationInviteType)
  .presenter(async ({ organizationInvite }, opts) => ({
    object: 'organization.invite',

    id: organizationInvite.id,
    status:
      organizationInvite.expiresAt < new Date()
        ? ('expired' as const)
        : organizationInvite.status,

    role: organizationInvite.role,
    type: organizationInvite.type,

    organization: await v1OrganizationPresenter
      .present({ organization: organizationInvite.organization }, opts)
      .run(),

    invited_by: await v1OrganizationActorPresenter
      .present(
        {
          organizationActor: {
            ...organizationInvite.invitedBy,
            organization: organizationInvite.organization
          }
        },
        opts
      )
      .run(),

    invite_link: {
      object: 'organization.invite.link',
      id: `oinl_${organizationInvite.key.slice(-12).split('').reverse().join('')}`,
      key: organizationInvite.type == 'link' ? organizationInvite.key : null,
      key_redacted: `...${organizationInvite.key.slice(-10)}`,
      url:
        organizationInvite.type == 'link'
          ? getConfig().urls.getInviteUrl(organizationInvite)
          : null,
      created_at: organizationInvite.createdAt
    },

    email: organizationInvite.email,

    created_at: organizationInvite.createdAt,
    updated_at: organizationInvite.createdAt,
    deleted_at: organizationInvite.deletedAt,
    expires_at: organizationInvite.expiresAt,
    accepted_at: organizationInvite.acceptedAt,
    rejected_at: organizationInvite.rejectedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.invite'),

      id: v.string({ name: 'id', description: `The organization invite's unique identifier` }),
      status: v.enumOf(['pending', 'accepted', 'rejected', 'expired', 'deleted'], {
        name: 'status',
        description: `The organization invite's status`
      }),
      role: v.enumOf(['member', 'admin'], {
        name: 'role',
        description: `The organization invite's role`
      }),
      type: v.enumOf(['link', 'email'], {
        name: 'type',
        description: `The organization invite's type`
      }),
      email: v.string({
        name: 'email',
        description: `The organization invite's email`,
        examples: ['test@example.com']
      }),
      organization: v1OrganizationPresenter.schema,
      invited_by: v1OrganizationActorPresenter.schema,
      invite_link: v.object({
        object: v.literal('organization.invite.link'),
        id: v.string({
          name: 'id',
          description: `The invite link's unique identifier`
        }),
        key: v.nullable(
          v.string({
            name: 'key',
            description: `The invite link's key`,
            examples: ['oinl_6YuLEErWCdFSdVGnqZLp']
          })
        ),
        key_redacted: v.string({
          name: 'keyRedacted',
          description: `The invite link's key redacted`,
          examples: ['...6YuLEErWCdFSdVGnqZLp']
        }),
        url: v.nullable(
          v.string({
            name: 'url',
            description: `The invite link's URL`,
            examples: ['https://app.metorial.com/join?invite_key=6YuLEErWCdFSdVGnqZLp']
          })
        ),
        created_at: v.date({
          name: 'createdAt',
          description: `The invite link's creation date`
        })
      }),
      created_at: v.date({
        name: 'createdAt',
        description: `The organization invite's creation date`
      }),
      updated_at: v.date({
        name: 'updatedAt',
        description: `The organization invite's last update date`
      }),
      deleted_at: v.date({
        name: 'deletedAt',
        description: `The organization invite's deletion date`
      }),
      expires_at: v.date({
        name: 'expiresAt',
        description: `The organization invite's expiration date`
      }),
      accepted_at: v.date({
        name: 'acceptedAt',
        description: `The organization invite's acceptance date`
      }),
      rejected_at: v.date({
        name: 'rejectedAt',
        description: `The organization invite's rejection date`
      })
    })
  )
  .build();
