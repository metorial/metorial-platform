import { v } from '@lowerdeck/validation';
import {
  fileLinkPresenter,
  filePresenter,
  filePurposePresenter,
  fileReferencePresenter
} from '../presenters';
import { reconcileService } from '@metorial-cargo/module-file';
import { app } from './_app';
import { tenantApp } from './tenant';

export let reconcileController = app.controller({
  purposes: app
    .handler()
    .input(
      v.object({
        items: v.array(
          v.object({
            id: v.optional(v.string()),
            slug: v.string(),
            name: v.string(),
            ownerType: v.enumOf(['user', 'organization', 'instance']),
            canHaveLinks: v.boolean()
          })
        )
      })
    )
    .do(async ctx =>
      (
        await reconcileService.reconcilePurposes({
          inputs: ctx.input.items as any
        })
      ).map(filePurposePresenter)
    ),

  files: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        items: v.array(
          v.object({
            id: v.string(),
            storeId: v.string(),
            purpose: v.string(),
            name: v.string(),
            mimeType: v.string(),
            size: v.number(),
            title: v.optional(v.string()),
            status: v.optional(v.enumOf(['active', 'deleted'])),
            links: v.optional(
              v.array(
                v.object({
                  id: v.optional(v.string()),
                  key: v.string(),
                  expiresAt: v.optional(v.date()),
                  references: v.optional(
                    v.array(
                      v.object({
                        id: v.optional(v.string()),
                        entityType: v.string(),
                        entityId: v.string()
                      })
                    )
                  )
                })
              )
            )
          })
        )
      })
    )
    .do(async ctx =>
      (
        await reconcileService.reconcileFiles({
          tenant: ctx.tenant,
          environment: ctx.environment,
          inputs: ctx.input.items as any
        })
      ).map(item => ({
        file: filePresenter(item.file),
        links: item.links.map(linkItem => ({
          link: fileLinkPresenter(linkItem.link),
          references: linkItem.references.map(fileReferencePresenter)
        }))
      }))
    )
});
