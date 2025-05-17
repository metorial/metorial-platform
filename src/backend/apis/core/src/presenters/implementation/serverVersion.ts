import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { serverVersionType } from '../types';

let tryGetHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return 'unknown';
  }
};

export let v1ServerVersionPresenter = Presenter.create(serverVersionType)
  .presenter(async ({ serverVersion }, opts) => ({
    object: 'server.server_version',

    id: serverVersion.id,
    identifier: serverVersion.identifier,

    server_id: serverVersion.server.id,
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

    schema: {
      id: serverVersion.schema.id,
      fingerprint: serverVersion.schema.fingerprint,
      schema:
        typeof serverVersion.schema.schema == 'string'
          ? JSON.parse(serverVersion.schema.schema)
          : serverVersion.schema.schema,

      server_id: serverVersion.server.id,
      server_variant_id: serverVersion.serverVariant.id,
      server_version_id: serverVersion.id,

      created_at: serverVersion.schema.createdAt
    },

    created_at: serverVersion.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('server.server_version'),

      id: v.string(),
      identifier: v.string(),

      server_id: v.string(),
      server_variant_id: v.string(),

      get_launch_params: v.string(),

      source: v.union([
        v.object({
          type: v.literal('docker'),
          docker: v.object({
            image: v.string(),
            tag: v.string()
          })
        }),
        v.object({
          type: v.literal('remote'),
          remote: v.object({
            domain: v.string()
          })
        })
      ]),

      schema: v.object({
        id: v.string(),
        fingerprint: v.string(),
        schema: v.record(v.any()),

        server_id: v.string(),
        server_variant_id: v.string(),
        server_version_id: v.string(),

        created_at: v.date()
      }),

      created_at: v.date()
    })
  )
  .build();
