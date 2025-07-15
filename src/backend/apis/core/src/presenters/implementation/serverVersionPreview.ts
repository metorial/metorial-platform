import { Server, ServerVariant, ServerVersion } from '@metorial/db';
import { v } from '@metorial/validation';
import { tryGetHostname } from '../../lib/tryGetHostname';

export let v1ServerVersionPreview = Object.assign(
  (serverVersion: ServerVersion, serverVariant: ServerVariant, server: Server) => ({
    object: 'server.server_version#preview',

    id: serverVersion.id,
    identifier: serverVersion.identifier,

    server_variant_id: serverVersion.id,
    server_id: server.id,

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

    created_at: serverVersion.createdAt
  }),
  {
    schema: v.object({
      object: v.literal('server.server_version#preview'),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the server version preview'
      }),

      identifier: v.string({
        name: 'identifier',
        description: 'A unique string identifier for the server version preview'
      }),

      server_id: v.string({
        name: 'server_id',
        description: 'The ID of the associated server'
      }),

      server_variant_id: v.string({
        name: 'server_variant_id',
        description: 'The ID of the associated server variant'
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
          description: 'Source details for the server version preview'
        }
      ),

      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the server version preview was created'
      })
    })
  }
);
