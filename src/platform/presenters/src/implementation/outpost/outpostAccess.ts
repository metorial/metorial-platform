import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { outpostAccessType } from '../../types';

let outpostServices: ['mcp_connection_proxy', 'outpost_registration_proxy'] = [
  'mcp_connection_proxy',
  'outpost_registration_proxy'
];

export let v1OutpostAccessPresenter = Presenter.create(outpostAccessType)
  .presenter(async ({ access }) => ({
    object: 'outpost_access',

    id: access.id,

    outpost_id: access.outpost.id,
    project_id: access.project.id,
    instance_id: access.instance.id,
    organization_id: access.organization.id,

    services: access.services,

    created_at: access.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('outpost_access', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: `The access grant's unique identifier`,
        examples: ['ota_4fGhJkLmNpQrStUv']
      }),

      outpost_id: v.string({
        name: 'outpost_id',
        description: `The id of the outpost this grant applies to`
      }),
      project_id: v.string({
        name: 'project_id',
        description: `The id of the instance's project`
      }),
      instance_id: v.string({
        name: 'instance_id',
        description: `The id of the instance this grant applies to`
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: `The id of the organization this grant applies to`
      }),

      services: v.array(
        v.enumOf(outpostServices, { description: 'A service id this grant allows access to' }),
        {
          name: 'services',
          description: `The services this grant allows access to`
        }
      ),

      created_at: v.date({
        name: 'created_at',
        description: `The access grant's creation date`
      })
    })
  )
  .build();
