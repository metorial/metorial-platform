import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  environmentService,
  skillTemplateService,
  tenantService
} from '../services';
import {
  skillTemplateDetailPresenter,
  skillTemplatePresenter
} from '../presenters';
import { app } from './_app';

let storeTemplateItemSchema = v.object({
  path: v.string(),
  type: v.enumOf(['file', 'document', 'directory']),
  content: v.optional(v.string()),
  encoding: v.optional(v.enumOf(['utf-8', 'base64']))
});

let resolveOptionalStoreTemplateScope = async (d: {
  tenantId?: string;
  environmentId?: string;
}) => {
  if (d.environmentId && !d.tenantId) {
    throw new ServiceError(
      badRequestError({
        message: 'tenantId is required when environmentId is provided'
      })
    );
  }

  let tenant = d.tenantId ? await tenantService.getTenantById({ id: d.tenantId }) : undefined;
  let environment = d.environmentId
    ? await environmentService.getEnvironmentById({
        tenant: tenant!,
        id: d.environmentId
      })
    : undefined;

  return {
    tenant,
    environment
  };
};

export let skillTemplateController = app.controller({
  create: app
    .handler()
    .input(
      v.object({
        skillTemplateId: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),
        storeId: v.optional(v.string()),
        name: v.string(),
        items: v.optional(v.array(storeTemplateItemSchema))
      })
    )
    .do(async ctx => {
      let scope = await resolveOptionalStoreTemplateScope({
        tenantId: ctx.input.tenantId,
        environmentId: ctx.input.environmentId
      });

      let skillTemplate = await skillTemplateService.createSkillTemplate({
        ...scope,
        input: {
          skillTemplateId: ctx.input.skillTemplateId,
          storeId: ctx.input.storeId,
          name: ctx.input.name,
          items: ctx.input.items
        }
      });

      return skillTemplateDetailPresenter(skillTemplate);
    }),

  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.optional(v.string()),
          environmentId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let scope = await resolveOptionalStoreTemplateScope({
        tenantId: ctx.input.tenantId,
        environmentId: ctx.input.environmentId
      });
      let paginator = await skillTemplateService.listSkillTemplates(scope);
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillTemplatePresenter);
    }),

  get: app
    .handler()
    .input(
      v.object({
        skillTemplateId: v.string()
      })
    )
    .do(async ctx =>
      skillTemplateDetailPresenter(
        await skillTemplateService.getSkillTemplateById({
          skillTemplateId: ctx.input.skillTemplateId
        })
      )
    ),

  update: app
    .handler()
    .input(
      v.object({
        skillTemplateId: v.string(),
        name: v.optional(v.string()),
        items: v.optional(v.array(storeTemplateItemSchema))
      })
    )
    .do(async ctx =>
      skillTemplateDetailPresenter(
        await skillTemplateService.updateSkillTemplate({
          skillTemplate: await skillTemplateService.getSkillTemplateById({
            skillTemplateId: ctx.input.skillTemplateId
          }),
          input: {
            name: ctx.input.name,
            items: ctx.input.items
          }
        })
      )
    ),

  delete: app
    .handler()
    .input(
      v.object({
        skillTemplateId: v.string()
      })
    )
    .do(async ctx =>
      skillTemplateDetailPresenter(
        await skillTemplateService.deleteSkillTemplate({
          skillTemplateId: ctx.input.skillTemplateId
        })
      )
    ),

  upsert: app
    .handler()
    .input(
      v.object({
        skillTemplateId: v.optional(v.string()),
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),
        systemIdentifier: v.string(),
        storeId: v.optional(v.string()),
        name: v.string(),
        items: v.optional(v.array(storeTemplateItemSchema))
      })
    )
    .do(async ctx => {
      let scope = await resolveOptionalStoreTemplateScope({
        tenantId: ctx.input.tenantId,
        environmentId: ctx.input.environmentId
      });

      let skillTemplate = await skillTemplateService.upsertSkillTemplate({
        ...scope,
        input: {
          skillTemplateId: ctx.input.skillTemplateId,
          systemIdentifier: ctx.input.systemIdentifier,
          storeId: ctx.input.storeId,
          name: ctx.input.name,
          items: ctx.input.items
        }
      });

      return skillTemplateDetailPresenter(skillTemplate);
    })
});
