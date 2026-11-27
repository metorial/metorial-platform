import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { oauthCallbackUrl } from '@mtsrc/slates-hub-env/oauthCallbackUrl';
import {
  slateOAuthCredentialsPresenter,
  slateOAuthCredentialsTemplatePresenter
} from '@mtsrc/slates-hub-presenters';
import { slateOAuthCredentialsTemplateService } from '@mtsrc/slates-hub-module-instances/slateOAuthCredentialsTemplate';
import { slateService } from '@mtsrc/slates-hub-module-catalog/slate';
import { app } from './_app';
import { tenantApp } from './tenant';

let templateApp = app.use(async ctx => {
  let templateId = ctx.body.templateId;
  if (!templateId) throw new Error('Template ID is required');

  let template = await slateOAuthCredentialsTemplateService.getTemplateById({ templateId });

  return { template };
});

let fixedInputValidator = v.record(v.string());

export let slateOAuthCredentialsTemplateController = app.controller({
  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          status: v.optional(v.enumOf(['active', 'archived'])),
          slateIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateOAuthCredentialsTemplateService.listTemplates({
        status: ctx.input.status,
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return {
        ...(await Paginator.presentLight(list, slateOAuthCredentialsTemplatePresenter)),
        callbackUrl: oauthCallbackUrl
      };
    }),

  get: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx => slateOAuthCredentialsTemplatePresenter(ctx.template)),

  create: app
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        authMethodKey: v.string(),
        fixedInput: v.optional(fixedInputValidator),
        clientId: v.string(),
        clientSecret: v.string(),
        scopes: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slate = await slateService.getSlateById({ id: ctx.input.slateId });

      let template = await slateOAuthCredentialsTemplateService.createTemplate({
        slate,
        name: ctx.input.name,
        description: ctx.input.description,
        authMethodKey: ctx.input.authMethodKey,
        fixedInput: ctx.input.fixedInput,
        clientId: ctx.input.clientId,
        clientSecret: ctx.input.clientSecret,
        scopes: ctx.input.scopes
      });

      return slateOAuthCredentialsTemplatePresenter(template);
    }),

  update: templateApp
    .handler()
    .input(
      v.object({
        templateId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        fixedInput: v.optional(v.nullable(fixedInputValidator)),
        clientId: v.optional(v.string()),
        clientSecret: v.optional(v.string()),
        scopes: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let template = await slateOAuthCredentialsTemplateService.updateTemplate({
        template: ctx.template,
        name: ctx.input.name,
        description: ctx.input.description,
        fixedInput: ctx.input.fixedInput,
        clientId: ctx.input.clientId,
        clientSecret: ctx.input.clientSecret,
        scopes: ctx.input.scopes
      });

      return slateOAuthCredentialsTemplatePresenter(template);
    }),

  archive: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx =>
      slateOAuthCredentialsTemplatePresenter(
        await slateOAuthCredentialsTemplateService.archiveTemplate({ template: ctx.template })
      )
    ),

  restore: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx =>
      slateOAuthCredentialsTemplatePresenter(
        await slateOAuthCredentialsTemplateService.restoreTemplate({ template: ctx.template })
      )
    ),

  delete: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx => {
      await slateOAuthCredentialsTemplateService.deleteTemplate({ template: ctx.template });
      return { success: true };
    }),

  getReplicationStatus: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx =>
      slateOAuthCredentialsTemplateService.getReplicationStatus({ template: ctx.template })
    ),

  replicate: tenantApp
    .handler()
    .input(v.object({ tenantId: v.string(), templateId: v.string() }))
    .do(async ctx => {
      let template = await slateOAuthCredentialsTemplateService.getTemplateById({
        templateId: ctx.input.templateId
      });

      let copy = await slateOAuthCredentialsTemplateService.replicateTemplate({
        tenant: ctx.tenant,
        template
      });

      return {
        template: slateOAuthCredentialsTemplatePresenter(template),
        copy: copy
          ? slateOAuthCredentialsPresenter({ ...copy, slate: template.slate, template })
          : null
      };
    })
});
