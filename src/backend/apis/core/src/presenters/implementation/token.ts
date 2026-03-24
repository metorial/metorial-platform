import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { tokenType } from '../types';

export let v1TokenPresenter = Presenter.create(tokenType)
  .presenter(async ({ token }, opts) => ({
    object: 'token',

    type: token.type,

    organization: token.organization
      ? {
          object: 'token.organization',
          id: token.organization.id,
          name: token.organization.name,
          slug: token.organization.slug
        }
      : null,

    instance: token.instance
      ? {
          object: 'token.organization.instance',
          id: token.instance.id,
          name: token.instance.name,
          slug: token.instance.slug,
          project_id: token.instance.project.id
        }
      : null,

    project: token.instance
      ? {
          object: 'token.organization.project',
          id: token.instance.project.id,
          name: token.instance.project.name,
          slug: token.instance.project.slug
        }
      : null,

    actor: token.actor
      ? {
          object: 'token.organization.actor',
          id: token.actor.id,
          type: token.actor.type,
          name: token.actor.name
        }
      : null,

    member: token.member
      ? {
          object: 'token.organization.member',
          id: token.member.id,
          name: token.member.actor.name
        }
      : null,

    user: token.user
      ? {
          object: 'token.user',
          id: token.user.id,
          name: token.user.name
        }
      : null
  }))
  .schema(
    v.object({
      object: v.literal('token', {
        description: "String representing the object's type"
      }),

      type: v.enumOf(
        [
          'fine_grained_token',
          'oauth_access_token',
          'unknown_token',
          'user_auth_token',
          'organization_management_token',
          'instance_access_token_secret',
          'instance_access_token_publishable'
        ],
        {
          name: 'type',
          description: `The token's type`
        }
      ),

      organization: v.nullable(
        v.object({
          object: v.literal('token.organization', {
            description: "String representing the organization's type"
          }),
          id: v.string({
            name: 'id',
            description: `The organization's unique identifier`,
            examples: ['org_7hNkPqRsTuVwXyZa']
          }),
          name: v.string({
            name: 'name',
            description: `The organization's name`,
            examples: ['Acme Corporation']
          }),
          slug: v.string({
            name: 'slug',
            description: `The organization's slug`,
            examples: ['acme-corporation']
          })
        })
      ),

      instance: v.nullable(
        v.object({
          object: v.literal('token.instance', {
            description: "String representing the instance's type"
          }),
          id: v.string({
            name: 'id',
            description: `The instance's unique identifier`,
            examples: ['ins_1a23BcDeFgHiJkLm']
          }),
          name: v.string({
            name: 'name',
            description: `The instance's name`,
            examples: ['Production Instance']
          }),
          slug: v.string({
            name: 'slug',
            description: `The instance's slug`,
            examples: ['production-instance']
          }),
          project_id: v.string({
            name: 'project_id',
            description: `The instance's project ID`,
            examples: ['prj_4x5YzAbCdEfGhIj']
          })
        })
      ),

      project: v.nullable(
        v.object({
          object: v.literal('token.project', {
            description: "String representing the project's type"
          }),
          id: v.string({
            name: 'id',
            description: `The project's unique identifier`,
            examples: ['prj_4x5YzAbCdEfGhIj']
          }),
          name: v.string({
            name: 'name',
            description: `The project's name`,
            examples: ['Acme Web App']
          }),
          slug: v.string({
            name: 'slug',
            description: `The project's slug`,
            examples: ['acme-web-app']
          })
        })
      ),

      actor: v.nullable(
        v.object({
          object: v.literal('token.organization_actor', {
            description: "String representing the organization actor's type"
          }),
          id: v.string({
            name: 'id',
            description: `The organization actor's unique identifier`,
            examples: ['omem_5fGhJkLmNpQrStUv']
          }),
          type: v.enumOf(['member', 'machine_access'], {
            name: 'type',
            description: `The organization actor's type`
          }),
          name: v.string({
            name: 'name',
            description: `The organization actor's name`,
            examples: ['Example']
          })
        })
      ),

      member: v.nullable(
        v.object({
          object: v.literal('token.organization_member', {
            description: "String representing the organization member's type"
          }),
          id: v.string({
            name: 'id',
            description: `The organization member's unique identifier`,
            examples: ['omem_5fGhJkLmNpQrStUv']
          }),
          name: v.string({
            name: 'name',
            description: `The organization member's name`,
            examples: ['Example']
          })
        })
      ),

      user: v.nullable(
        v.object({
          object: v.literal('token.user', {
            description: "String representing the user's type"
          }),
          id: v.string({
            name: 'id',
            description: `The user's unique identifier`,
            examples: ['user_1a2b3c4d5e6f7g8h']
          }),
          name: v.string({
            name: 'name',
            description: `The user's name`,
            examples: ['Example User']
          })
        })
      )
    })
  )
  .build();
