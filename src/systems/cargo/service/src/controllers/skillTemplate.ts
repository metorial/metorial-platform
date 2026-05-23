import { badRequestError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { skillTemplateDetailPresenter, skillTemplatePresenter } from '../presenters';
import { environmentService, tenantService } from '@metorial-cargo/module-file';
import { skillTemplateService } from '@metorial-cargo/module-skill';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { tenantApp } from './tenant';

let storeTemplateItemSchema = v.object({
  path: v.string(),
  type: v.enumOf(['file', 'document', 'directory']),
  content: v.optional(v.string()),
  encoding: v.optional(v.enumOf(['utf-8', 'base64'])),
  mimeType: v.optional(v.string()),
  title: v.optional(v.string())
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
        skillTemplateId: v.string(),
        tenantId: v.optional(v.string()),
        environmentId: v.optional(v.string()),
        skillId: v.optional(v.string()),
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
          id: ctx.input.skillTemplateId,
          skillId: ctx.input.skillId,
          storeId: ctx.input.storeId,
          name: ctx.input.name,
          items: ctx.input.items
        }
      });

      return skillTemplateDetailPresenter(skillTemplate);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          skillTemplateIds: v.optional(v.array(v.string())),
          storeTemplateIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await skillTemplateService.listSkillTemplates({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.skillTemplateIds,
        storeTemplateIds: ctx.input.storeTemplateIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, skillTemplatePresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateId: v.string()
      })
    )
    .do(async ctx => {
      return skillTemplateDetailPresenter(
        await skillTemplateService.getSkillTemplateById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillTemplateId: ctx.input.skillTemplateId
        })
      );
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let skillTemplates = await skillTemplateService.getManySkillTemplatesByIds({
        tenant: ctx.tenant,
        environment: ctx.environment,
        skillTemplateIds: ctx.input.skillTemplateIds
      });

      return skillTemplates.map(skillTemplatePresenter);
    }),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateId: v.string(),
        name: v.optional(v.string()),
        items: v.optional(v.array(storeTemplateItemSchema))
      })
    )
    .do(async ctx => {
      return skillTemplateDetailPresenter(
        await skillTemplateService.updateSkillTemplate({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillTemplateId: ctx.input.skillTemplateId,
          input: {
            name: ctx.input.name,
            items: ctx.input.items
          }
        })
      );
    }),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        skillTemplateId: v.string()
      })
    )
    .do(async ctx => {
      return skillTemplateDetailPresenter(
        await skillTemplateService.deleteSkillTemplate({
          tenant: ctx.tenant,
          environment: ctx.environment,
          skillTemplateId: ctx.input.skillTemplateId
        })
      );
    }),

  upsert: app
    .handler()
    .input(
      v.object({
        skillTemplateId: v.string(),
        systemIdentifier: v.string(),
        storeId: v.optional(v.string()),
        name: v.string(),
        items: v.optional(v.array(storeTemplateItemSchema))
      })
    )
    .do(async ctx => {
      let skillTemplate = await skillTemplateService.upsertSkillTemplate({
        input: {
          id: ctx.input.skillTemplateId,
          systemIdentifier: ctx.input.systemIdentifier,
          storeId: ctx.input.storeId,
          name: ctx.input.name,
          items: ctx.input.items
        }
      });

      return skillTemplateDetailPresenter(skillTemplate);
    })
});
