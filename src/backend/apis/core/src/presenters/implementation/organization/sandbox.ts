import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxType } from '../../types';
import { v1InstancePresenter } from './instance';
import { v1OrganizationActorPresenter } from './organizationActor';

export let v1SandboxPresenter = Presenter.create(sandboxType)
  .presenter(async ({ sandbox }, opts) => ({
    object: 'organization.sandbox',

    id: sandbox.id,
    name: sandbox.name,
    organization_id: sandbox.instance.organization.id,
    instance: await v1InstancePresenter.present({ instance: sandbox.instance }, opts).run(),
    creator_actor: await v1OrganizationActorPresenter
      .present({ organizationActor: sandbox.creatorActor }, opts)
      .run(),
    created_at: new Date(sandbox.createdAt),
    updated_at: new Date(sandbox.updatedAt)
  }))
  .schema(
    v.object({
      object: v.literal('organization.sandbox', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The sandbox's unique identifier`,
        examples: ['sbox_9sTuVwXyZaBcDeFg']
      }),
      name: v.string({
        name: 'name',
        description: `The sandbox's name`,
        examples: ['Development Sandbox']
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The organization's unique identifier`,
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      instance: v1InstancePresenter.schema,
      creator_actor: v1OrganizationActorPresenter.schema,
      created_at: v.date({
        name: 'created_at',
        description: `The sandbox's creation date`,
        examples: [new Date('2026-01-29T12:35:22.304Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: `The sandbox's last update date`,
        examples: [new Date('2026-01-29T12:35:22.304Z')]
      })
    })
  )
  .build();
