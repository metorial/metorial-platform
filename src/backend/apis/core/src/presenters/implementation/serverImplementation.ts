import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverImplementationType } from '../types';
import { v1ServerPreview } from './serverPreview';
import { v1ServerVariantPreview } from './serverVariantPreview';

export let v1ServerImplementationPresenter = Presenter.create(serverImplementationType)
  .presenter(async ({ serverImplementation }, opts) => ({
    object: 'server.server_implementation',

    id: serverImplementation.id,
    status: serverImplementation.status,

    name: serverImplementation.name,
    description: serverImplementation.description,

    metadata: serverImplementation.metadata ?? {},
    get_launch_params: serverImplementation.getLaunchParams,

    server_variant: v1ServerVariantPreview(
      serverImplementation.serverVariant,
      serverImplementation.server
    ),

    server: v1ServerPreview(serverImplementation.server),

    created_at: serverImplementation.createdAt,
    updated_at: serverImplementation.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_implementation'),

      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),

      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.record(v.any()),

      get_launch_params: v.nullable(v.string()),

      server_variant: v1ServerVariantPreview.schema,
      server: v1ServerPreview.schema,

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let dashboardServerImplementationPresenter = Presenter.create(serverImplementationType)
  .presenter(async ({ serverImplementation }, opts) => ({
    object: 'server.server_implementation',

    id: serverImplementation.id,
    status: serverImplementation.status,

    is_default: !!serverImplementation.isDefault,
    is_ephemeral: serverImplementation.isEphemeral,

    name: serverImplementation.name,
    description: serverImplementation.description,

    metadata: serverImplementation.metadata,
    get_launch_params: serverImplementation.getLaunchParams,

    server_variant: v1ServerVariantPreview(
      serverImplementation.serverVariant,
      serverImplementation.server
    ),

    server: v1ServerPreview(serverImplementation.server),

    created_at: serverImplementation.createdAt,
    updated_at: serverImplementation.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_implementation'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server implementation'
      }),

      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'The current status of the server implementation'
      }),

      is_default: v.boolean({
        name: 'is_default',
        description: 'Indicates if this implementation is the default one'
      }),

      is_ephemeral: v.boolean({
        name: 'is_ephemeral',
        description: 'Indicates if this implementation is ephemeral (temporary)'
      }),

      name: v.string({
        name: 'name',
        description: 'The name of the server implementation'
      }),

      description: v.nullable(
        v.string({
          name: 'description',
          description: 'A description of the server implementation, if any'
        })
      ),

      metadata: v.record(v.any(), {
        name: 'metadata',
        description: 'Additional metadata related to the server implementation'
      }),

      get_launch_params: v.nullable(
        v.string({
          name: 'get_launch_params',
          description: 'Launch parameters for this server implementation, if any'
        })
      ),

      server_variant: v1ServerVariantPreview.schema,

      server: v1ServerPreview.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server implementation was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when the server implementation was last updated'
      })
    })
  )
  .build();
