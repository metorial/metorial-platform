import { v } from '@mtsrc/validation';
import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { organizationInviteType } from '../../types';
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

    email: organizationInvite.email,

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

    created_at: organizationInvite.createdAt,
    updated_at: organizationInvite.createdAt,
    expires_at: organizationInvite.expiresAt,
    accepted_at: organizationInvite.acceptedAt,
    rejected_at: organizationInvite.rejectedAt,
    deleted_at: organizationInvite.deletedAt,

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
      .run()
  }))
  .schema(
    v.object({
      object: v.literal('organization.invite', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The organization invite's unique identifier`,
        examples: ['oinv_4dEfGhJkLmNpQrSt']
      }),

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
        examples: ['jordan.smith@company.com']
      }),

      invite_link: v.object({
        object: v.literal('organization.invite.link', {
          description: "String representing the object's type"
        }),
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
          name: 'key_redacted',
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
          name: 'created_at',
          description: `The invite link's creation date`,
          examples: [new Date('2024-01-15T09:30:00Z')]
        })
      }),

      created_at: v.date({
        name: 'created_at',
        description: `The organization invite's creation date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: `The organization invite's last update date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      expires_at: v.date({
        name: 'expires_at',
        description: `The organization invite's expiration date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      accepted_at: v.date({
        name: 'accepted_at',
        description: `The organization invite's acceptance date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      rejected_at: v.date({
        name: 'rejected_at',
        description: `The organization invite's rejection date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      deleted_at: v.date({
        name: 'deleted_at',
        description: `The organization invite's deletion date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      organization: v1OrganizationPresenter.schema,

      invited_by: v1OrganizationActorPresenter.schema
    })
  )
  .build();
