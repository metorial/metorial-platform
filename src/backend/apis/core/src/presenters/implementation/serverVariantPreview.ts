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

      id: v.string(),
      identifier: v.string(),

      server_id: v.string(),

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
    })
  }
);
