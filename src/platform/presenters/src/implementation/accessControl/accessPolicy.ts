import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { accessPolicyType } from '../../types';

export let v1AccessPolicyPresenter = Presenter.create(accessPolicyType)
  .presenter(async ({ accessPolicy }) => ({
    object: 'management.access_policy',
    id: accessPolicy.id,
    organization_id: accessPolicy.organization.id,
    type: accessPolicy.type,
    name: accessPolicy.name,
    slug: accessPolicy.slug,
    description: accessPolicy.description,
    document: accessPolicy.document,
    roles: accessPolicy.accessPolicyRoles.map(item => ({
      id: item.accessRole.id,
      name: item.accessRole.name,
      slug: item.accessRole.slug
    })),
    projects: accessPolicy.accessPolicyProjects.map(item => ({
      id: item.project.id,
      slug: item.project.slug,
      name: item.project.name
    })),
    instances: accessPolicy.accessPolicyInstances.map(item => ({
      id: item.instance.id,
      name: item.instance.name
    })),
    created_at: accessPolicy.createdAt,
    updated_at: accessPolicy.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('management.access_policy', {
        description: "String representing the full access policy object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique identifier of the access policy',
        examples: ['apl_7hNkPqRsTuVwXyZa']
      }),
      organization_id: v.string({
        name: 'organization_id',
        description: 'Organization that owns this access policy',
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      type: v.enumOf(['everyone', 'admin', 'custom'], {
        name: 'type',
        description: 'Policy kind for this access policy'
      }),
      name: v.string({
        name: 'name',
        description: 'Human-readable access policy name',
        examples: ['Support Engineers']
      }),
      slug: v.string({
        name: 'slug',
        description: 'Stable slug for the access policy',
        examples: ['support-engineers']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Optional description of what this policy grants'
        })
      ),
      document: v.object({
        access: v.array(
          v.object({
            target: v.string({
              name: 'target',
              description:
                'Target resource identifier such as an organization, project, or instance ID',
              examples: ['ins_7hNkPqRsTuVwXyZa']
            }),
            scopes: v.optional(
              v.array(v.string(), {
                name: 'scopes',
                description: 'Scopes granted directly for the target'
              })
            ),
            roles: v.optional(
              v.array(v.string(), {
                name: 'roles',
                description: 'Access role identifiers granted for the target'
              })
            )
          })
        )
      }),
      roles: v.array(
        v.object({
          id: v.string({
            name: 'id',
            description: 'Access role identifier referenced by this policy'
          }),
          name: v.string({
            name: 'name',
            description: 'Access role name referenced by this policy'
          }),
          slug: v.string({
            name: 'slug',
            description: 'Access role slug referenced by this policy'
          })
        }),
        {
          name: 'roles',
          description: 'Resolved access roles referenced by the current policy document'
        }
      ),
      projects: v.array(
        v.object({
          id: v.string({
            name: 'id',
            description: 'Project identifier referenced by this policy'
          }),
          slug: v.string({
            name: 'slug',
            description: 'Project slug referenced by this policy'
          }),
          name: v.string({
            name: 'name',
            description: 'Project name referenced by this policy'
          })
        }),
        {
          name: 'projects',
          description: 'Resolved projects referenced by the current policy document'
        }
      ),
      instances: v.array(
        v.object({
          id: v.string({
            name: 'id',
            description: 'Instance identifier referenced by this policy'
          }),
          name: v.string({
            name: 'name',
            description: 'Instance name referenced by this policy'
          })
        }),
        {
          name: 'instances',
          description: 'Resolved instances referenced by the current policy document'
        }
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when this access policy was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when this access policy was last updated'
      })
    })
  )
  .build();
