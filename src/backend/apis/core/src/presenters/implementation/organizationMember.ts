import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { organizationMemberType } from '../types';
import { v1OrganizationActorPresenter } from './organizationActor';

export let v1OrganizationMemberPresenter = Presenter.create(organizationMemberType)
  .presenter(async ({ organizationMember }, opts) => ({
    object: 'organization.member',

    id: organizationMember.id,
    status: organizationMember.status,
    role: organizationMember.role,

    user_id: organizationMember.user.id,
    organization_id: organizationMember.organization.id,
    actor_id: organizationMember.actor.id,

    last_active_at: organizationMember.lastActiveAt,
    created_at: organizationMember.createdAt,
    updated_at: organizationMember.updatedAt,
    deleted_at: organizationMember.deletedAt,

    actor: await v1OrganizationActorPresenter
      .present(
        {
          organizationActor: {
            ...organizationMember.actor,
            organization: organizationMember.organization
          }
        },
        opts
      )
      .run()
  }))
  .schema(
    v.object({
      object: v.literal('organization.member', {
        description: "String representing the object's type"
      }),

      id: v.string({ name: 'id', description: `The organization member's unique identifier` }),

      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: `The organization member's status`
      }),

      role: v.enumOf(['member', 'admin'], {
        name: 'role',
        description: `The organization member's role`
      }),

      user_id: v.string({
        name: 'user_id',
        description: `The organization member's user ID`
      }),

      organization_id: v.string({
        name: 'organization_id',
        description: `The organization member's organization ID`
      }),

      actor_id: v.string({
        name: 'actor_id',
        description: `The organization member's actor ID`
      }),

      last_active_at: v.date({
        name: 'last_active_at',
        description: `The organization member's last active date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      created_at: v.date({
        name: 'created_at',
        description: `The organization member's creation date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: `The organization member's last update date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      deleted_at: v.date({
        name: 'deleted_at',
        description: `The organization member's deletion date`,
        examples: [new Date('2024-01-15T09:30:00Z')]
      }),

      actor: v1OrganizationActorPresenter.schema
    })
  )
  .build();
