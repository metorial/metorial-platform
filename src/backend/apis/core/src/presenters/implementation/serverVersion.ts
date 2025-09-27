import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { tryGetHostname } from '../../lib/tryGetHostname';
import { serverVersionType } from '../types';
import { v1ServerPreview } from './serverPreview';

export let v1ServerVersionPresenter = Presenter.create(serverVersionType)
  .presenter(async ({ serverVersion }, opts) => ({
    object: 'server.server_version',

    id: serverVersion.id,
    identifier: serverVersion.identifier,

    server_variant_id: serverVersion.serverVariant.id,

    get_launch_params: serverVersion.getLaunchParams,

    source: {
      type: serverVersion.sourceType,
      docker: serverVersion.dockerImage
        ? {
            image: serverVersion.dockerImage,
            tag: serverVersion.dockerTag
          }
        : null,
      remote: serverVersion.remoteUrl
        ? {
            domain: tryGetHostname(serverVersion.remoteUrl)
          }
        : null
    } as any,

    schema:
      typeof serverVersion.schema.schema == 'string'
        ? JSON.parse(serverVersion.schema.schema)
        : serverVersion.schema.schema,

    server: v1ServerPreview(serverVersion.server),

    created_at: serverVersion.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_version'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server version'
      }),

      identifier: v.string({
        name: 'identifier',
        description: 'A unique string identifier for the server version'
      }),

      server_id: v.string({
        name: 'server_id',
        description: 'The ID of the associated server'
      }),

      server_variant_id: v.string({
        name: 'server_variant_id',
        description: 'The ID of the associated server variant'
      }),

      get_launch_params: v.string({
        name: 'get_launch_params',
        description: 'Parameters used to launch this server version'
      }),

      source: v.union(
        [
          v.object({
            type: v.literal('docker'),
            docker: v.object({
              image: v.string({
                name: 'image',
                description: 'Docker image name for this server version'
              }),
              tag: v.string({
                name: 'tag',
                description: 'Docker image tag/version'
              })
            })
          }),
          v.object({
            type: v.literal('remote'),
            remote: v.object({
              domain: v.string({
                name: 'domain',
                description: 'Remote domain hosting the server version'
              })
            })
          })
        ],
        {
          name: 'source',
          description: 'The source configuration for this server version'
        }
      ),

      schema: v.record(v.any(), {
        name: 'schema',
        description: 'The actual schema definition'
      }),

      server: v1ServerPreview.schema,

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server version was created'
      })
    })
  )
  .build();
