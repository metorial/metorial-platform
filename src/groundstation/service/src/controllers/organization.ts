import { v } from '@lowerdeck/validation';
import { organizationPresenter } from '../presenters';
import { organizationService } from '../services';
import { app, organizationApp } from './_app';

let organizationSettingsSchema = v.object({
  allowedEmailDomains: v.optional(
    v.array(v.string({ modifiers: [v.minLength(1), v.maxLength(253)] }), {
      modifiers: [v.maxLength(100)]
    })
  ),
  sliceErasureMode: v.optional(v.enumOf(['anonymize', 'delete']))
});

export let organizationController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        ref: v.string({ modifiers: [v.minLength(1)] }),
        name: v.optional(v.nullable(v.string())),
        settings: v.optional(organizationSettingsSchema)
      })
    )
    .do(async ctx => {
      let organization = await organizationService.upsertOrganization({
        input: {
          ref: ctx.input.ref,
          name: ctx.input.name,
          settings: ctx.input.settings && {
            ...ctx.input.settings,
            allowedEmailDomains: ctx.input.settings.allowedEmailDomains?.map(domain =>
              domain.trim().toLowerCase()
            )
          }
        }
      });

      return organizationPresenter(organization);
    }),

  get: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string() }))
    .do(async ctx => organizationPresenter(ctx.organization)),

  archive: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string() }))
    .do(async ctx => {
      let organization = await organizationService.archiveOrganization({
        organization: ctx.organization
      });

      return organizationPresenter(organization);
    }),

  erase: app
    .handler()
    .input(v.object({ organizationId: v.string() }))
    .do(async ctx => {
      let organization = await organizationService.getOrganizationById({
        organizationId: ctx.input.organizationId,
        includeArchived: true
      });

      await organizationService.eraseOrganization({ organization });

      return { organizationId: organization.id, erasing: true };
    })
});
