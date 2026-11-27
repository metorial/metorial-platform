import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { organizationType } from '../../types';

export let v1OrganizationPresenter = Presenter.create(organizationType)
  .presenter(async ({ organization }, opts) => ({
    object: 'organization',

    id: organization.id,
    type: organization.type,
    slug: organization.slug,
    name: organization.name,
    image_url: await getImageUrl(organization),
    magic_mcp_origin: organization.magicMcpOrigin,
    created_at: organization.createdAt,
    updated_at: organization.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization', {
        description: 'String representing the object’s type.'
      }),

      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['org_7hNkPqRsTuVwXyZa']
      }),
      type: v.enumOf(['default'], {
        name: 'type',
        description: 'Always `default`.'
      }),
      slug: v.string({
        name: 'slug',
        description: 'URL-safe name, unique across Metorial.',
        examples: ['acme-corp']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name.',
        examples: ['Acme Corporation']
      }),
      image_url: v.string({
        name: 'image_url',
        description: 'Uploaded logo, or a generated avatar when none is set.',
        examples: ['https://avatar-cdn.metorial.com/aimg_1234567890']
      }),
      magic_mcp_origin: v.nullable(
        v.string({
          name: 'magic_mcp_origin',
          description:
            'Origin that replaces the default host in Magic MCP URLs, for example a self-hosted outpost proxy. `null` uses the default host. The `/connect/portal/:slug` path is unaffected.',
          examples: ['https://mcp.acme.com']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.'
      })
    })
  )
  .build();
