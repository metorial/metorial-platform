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

      id: v.string(),
      identifier: v.string(),

      server: v1ServerPreview.schema,

      current_version: v.nullable(v1ServerVersionPresenter.schema),

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
  )
  .build();
