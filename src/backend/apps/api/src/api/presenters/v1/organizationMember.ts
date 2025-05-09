import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { organizationMemberType } from '../types';
import { v1OrganizationActorPresenter } from './organizationActor';

export let v1OrganizationMemberPresenter = Presenter.create(organizationMemberType)
  .presenter(async ({ organizationMember }, opts) => ({
    id: organizationMember.id,
    status: organizationMember.status,
    role: organizationMember.role,

    user_id: organizationMember.user.id,
    organization_id: organizationMember.organization.id,
    actor_id: organizationMember.actor.id,

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
      .run(),

    last_active_at: organizationMember.lastActiveAt,
    deleted_at: organizationMember.deletedAt,
    created_at: organizationMember.createdAt,
    updated_at: organizationMember.updatedAt
  }))
  .schema(
    v.object({
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
      actor: v1OrganizationActorPresenter.schema,
      last_active_at: v.date({
        name: 'last_active_at',
        description: `The organization member's last active date`
      }),
      deleted_at: v.date({
        name: 'deleted_at',
        description: `The organization member's deletion date`
      }),
      created_at: v.date({
        name: 'created_at',
        description: `The organization member's creation date`
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The organization member's last update date`
      })
    })
  )
  .build();
