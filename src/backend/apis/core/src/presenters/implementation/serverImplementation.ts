import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverImplementationType } from '../types';
import { tryGetHostname } from './serverVariant';

export let v1ServerImplementationPresenter = Presenter.create(serverImplementationType)
  .presenter(async ({ serverImplementation }, opts) => ({
    object: 'server.server_implementation',

    id: serverImplementation.id,
    status: serverImplementation.status,

    name: serverImplementation.name,
    description: serverImplementation.description,

    metadata: serverImplementation.metadata,
    get_launch_params: serverImplementation.getLaunchParams,

    server_variant: {
      id: serverImplementation.serverVariant.id,
      identifier: serverImplementation.serverVariant.identifier,

      source: {
        type: serverImplementation.serverVariant.sourceType,
        docker: serverImplementation.serverVariant.dockerImage
          ? {
              image: serverImplementation.serverVariant.dockerImage
            }
          : null,
        remote: serverImplementation.serverVariant.remoteUrl
          ? {
              domain: tryGetHostname(serverImplementation.serverVariant.remoteUrl)
            }
          : null
      } as any,

      created_at: serverImplementation.serverVariant.createdAt
    },

    server: {
      id: serverImplementation.server.id,
      name: serverImplementation.server.name,
      description: serverImplementation.server.description,

      type: { imported: 'public' as const }[serverImplementation.server.type],

      created_at: serverImplementation.server.createdAt,
      updated_at: serverImplementation.server.updatedAt
    },

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

      server_variant: v.object({
        id: v.string(),
        identifier: v.string(),

        source: v.union([
          v.object({
            type: v.literal('docker'),
            docker: v.object({
              image: v.string()
            })
          }),
          v.object({
            type: v.literal('remote'),
            remote: v.object({
              domain: v.string()
            })
          })
        ]),

        created_at: v.date()
      }),

      server: v.object({
        id: v.string(),
        name: v.string(),
        description: v.nullable(v.string()),
        type: v.enumOf(['public']),

        created_at: v.date(),
        updated_at: v.date()
      }),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
