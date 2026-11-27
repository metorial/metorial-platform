import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { getScmProviderOptions, scmProviderTypes } from '../lib/scmPolicy';
import { scmBackendPresenter } from '../presenters/scmBackend';
import {
  getScmOAuthCallbackUrl,
  scmBackendTemplatePresenter
} from '../presenters/scmBackendTemplate';
import { scmBackendTemplateService } from '../services/scmBackendTemplate';
import { app } from './_app';
import { tenantApp } from './tenant';

let templateApp = app.use(async ctx => {
  let templateId = ctx.body.templateId;
  if (!templateId) throw new Error('Template ID is required');

  let template = await scmBackendTemplateService.getTemplateById({ templateId });

  return { template };
});

let tenantTemplateApp = tenantApp.use(async ctx => {
  let templateId = ctx.body.templateId;
  if (!templateId) throw new Error('Template ID is required');

  let template = await scmBackendTemplateService.getTemplateById({ templateId });

  return { template };
});

export let scmBackendTemplateController = app.controller({
  providerOptions: app
    .handler()
    .input(v.object({}))
    .do(async () => ({
      items: getScmProviderOptions().map(option => ({
        ...option,
        oauthCallbackUrl: getScmOAuthCallbackUrl(option.type)
      }))
    })),

  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          status: v.optional(v.enumOf(['active', 'archived']))
        })
      )
    )
    .do(async ctx => {
      let paginator = await scmBackendTemplateService.listTemplates({
        status: ctx.input.status
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, scmBackendTemplatePresenter);
    }),

  get: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx => scmBackendTemplatePresenter(ctx.template)),

  create: app
    .handler()
    .input(
      v.object({
        type: v.enumOf([...scmProviderTypes]),
        name: v.string(),
        description: v.optional(v.string()),
        webUrl: v.string(),
        appId: v.optional(v.string()),
        appSlug: v.optional(v.string()),
        appPrivateKey: v.optional(v.string()),
        appWebhookSecret: v.optional(v.string()),
        clientId: v.string(),
        clientSecret: v.string()
      })
    )
    .do(async ctx => {
      let template = await scmBackendTemplateService.createTemplate(ctx.input);

      return scmBackendTemplatePresenter(template);
    }),

  update: templateApp
    .handler()
    .input(
      v.object({
        templateId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.nullable(v.string())),
        appId: v.optional(v.string()),
        appSlug: v.optional(v.string()),
        clientId: v.optional(v.string()),
        clientSecret: v.optional(v.string()),
        appPrivateKey: v.optional(v.string()),
        appWebhookSecret: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let { templateId, ...input } = ctx.input;
      let template = await scmBackendTemplateService.updateTemplate({
        ...input,
        template: ctx.template
      });

      return scmBackendTemplatePresenter(template);
    }),

  archive: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx =>
      scmBackendTemplatePresenter(
        await scmBackendTemplateService.archiveTemplate({ template: ctx.template })
      )
    ),

  restore: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx =>
      scmBackendTemplatePresenter(
        await scmBackendTemplateService.restoreTemplate({ template: ctx.template })
      )
    ),

  delete: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx => {
      await scmBackendTemplateService.deleteTemplate({ template: ctx.template });

      return { success: true };
    }),

  getReplicationStatus: templateApp
    .handler()
    .input(v.object({ templateId: v.string() }))
    .do(async ctx =>
      scmBackendTemplateService.getReplicationStatus({ template: ctx.template })
    ),

  replicate: tenantTemplateApp
    .handler()
    .input(v.object({ tenantId: v.string(), templateId: v.string() }))
    .do(async ctx => {
      let backend = await scmBackendTemplateService.replicateTemplate({
        tenant: ctx.tenant,
        template: ctx.template
      });

      return { backend: backend ? scmBackendPresenter(backend) : null };
    })
});
