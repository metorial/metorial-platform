import { Server, ServerVariant } from '@metorial/db';
import { v } from '@metorial/validation';
import { tryGetHostname } from '../../lib/tryGetHostname';

export let v1ServerVariantPreview = Object.assign(
  (serverVariant: ServerVariant, server: Server) => ({
    object: 'server.server_variant#preview',

    id: serverVariant.id,
    identifier: serverVariant.identifier,

    server_id: server.id,

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

    created_at: serverVariant.createdAt
  }),
  {
    schema: v.object({
      object: v.literal('server.server_variant#preview'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server variant preview'
      }),

      identifier: v.string({
        name: 'identifier',
        description: 'A unique string identifier for the server variant'
      }),

      server_id: v.string({
        name: 'server_id',
        description: 'The unique identifier of the parent server'
      }),

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
          description: 'The source configuration for the server variant preview'
        }
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server variant preview was created'
      })
    })
  }
);
