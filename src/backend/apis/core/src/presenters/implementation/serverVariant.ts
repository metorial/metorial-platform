import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { tryGetHostname } from '../../lib/tryGetHostname';
import { serverVariantType } from '../types';
import { v1ServerPreview } from './serverPreview';
import { v1ServerVersionPresenter } from './serverVersion';

export let v1ServerVariantPresenter = Presenter.create(serverVariantType)
  .presenter(async ({ serverVariant }, opts) => ({
    object: 'server.server_variant',

    id: serverVariant.id,
    identifier: serverVariant.identifier,

    status: serverVariant.status,

    server: v1ServerPreview(serverVariant.server),

    source: {
      type: serverVariant.sourceType,
      docker: serverVariant.dockerImage
        ? {
            image: serverVariant.dockerImage
          }
        : null,
      remote: serverVariant.remoteUrl
        ? {
            domain: tryGetHostname(serverVariant.remoteUrl)
          }
        : null
    } as any,

    current_version: serverVariant.currentVersion
      ? await v1ServerVersionPresenter
          .present(
            {
              serverVersion: {
                ...serverVariant.currentVersion,
                server: serverVariant.server,
                serverVariant: serverVariant
              }
            },
            opts
          )
          .run()
      : null,

    created_at: serverVariant.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_variant'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier for this server variant'
      }),

      status: v.enumOf(['active', 'inactive'], {
        name: 'status',
        description: 'The current status of the server variant'
      }),

      identifier: v.string({
        name: 'identifier',
        description: 'A unique string identifier for the server variant'
      }),

      server: v1ServerPreview.schema,

      current_version: v.nullable(v1ServerVersionPresenter.schema),

      source: v.union(
        [
          v.object({
            type: v.literal('docker'),

            docker: v.object({
              image: v.string({
                name: 'image',
                description: 'The Docker image used by this server variant'
              })
            })
          }),
          v.object({
            type: v.literal('remote'),

            remote: v.object({
              domain: v.string({
                name: 'domain',
                description: 'The remote domain hosting this server variant'
              })
            })
          })
        ],
        {
          name: 'source',
          description: 'The source type and configuration for this server variant'
        }
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server variant was created'
      })
    })
  )
  .build();
