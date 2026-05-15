import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeTemplateDetailPresenter, storeTemplatePresenter } from '../presenters';
import { environmentService, tenantService } from '@metorial-cargo/module-file';
import { storeTemplateService } from '@metorial-cargo/module-store';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';

let storeTemplateItemSchema = v.object({
  path: v.string(),
  type: v.enumOf(['file', 'document', 'directory']),
  content: v.optional(v.string()),
  encoding: v.optional(v.enumOf(['utf-8', 'base64'])),
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

let resolveRequiredStoreTemplateScope = async (d: {
  tenantId: string;
  environmentId: string;
}) => {
  let tenant = await tenantService.getTenantById({ id: d.tenantId });
  let environment = await environmentService.getEnvironmentById({
    tenant,
    id: d.environmentId
  });

  return {
    tenant,
    environment
  };
};

export let storeTemplateController = app.controller({
  create: app
    .handler()
    .input(
      v.object({
        storeTemplateId: v.optional(v.string()),
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

      let storeTemplate = await storeTemplateService.createStoreTemplate({
        ...scope,
        input: {
          id: ctx.input.storeTemplateId,
          storeId: ctx.input.storeId,
          name: ctx.input.name,
          items: ctx.input.items
        }
      });

      return storeTemplateDetailPresenter(storeTemplate);
    }),

  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          storeTemplateIds: v.optional(v.array(v.string())),
          sourceStoreIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let scope = await resolveRequiredStoreTemplateScope({
        tenantId: ctx.input.tenantId,
        environmentId: ctx.input.environmentId
      });
      let paginator = await storeTemplateService.listStoreTemplates({
        ...scope,
        ids: ctx.input.storeTemplateIds,
        sourceStoreIds: ctx.input.sourceStoreIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, storeTemplatePresenter);
    }),

  get: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeTemplateId: v.string()
      })
    )
    .do(async ctx => {
      let scope = await resolveRequiredStoreTemplateScope({
        tenantId: ctx.input.tenantId,
        environmentId: ctx.input.environmentId
      });

      return storeTemplateDetailPresenter(
        await storeTemplateService.getStoreTemplateById({
          ...scope,
          storeTemplateId: ctx.input.storeTemplateId
        })
      );
    }),

  update: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeTemplateId: v.string(),
        name: v.optional(v.string()),
        items: v.optional(v.array(storeTemplateItemSchema))
      })
    )
    .do(async ctx => {
      let scope = await resolveRequiredStoreTemplateScope({
        tenantId: ctx.input.tenantId,
        environmentId: ctx.input.environmentId
      });

      return storeTemplateDetailPresenter(
        await storeTemplateService.updateStoreTemplate({
          ...scope,
          storeTemplate: await storeTemplateService.getStoreTemplateById({
            ...scope,
            storeTemplateId: ctx.input.storeTemplateId
          }),
          input: {
            name: ctx.input.name,
            items: ctx.input.items
          }
        })
      );
    }),

  delete: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeTemplateId: v.string()
      })
    )
    .do(async ctx => {
      let scope = await resolveRequiredStoreTemplateScope({
        tenantId: ctx.input.tenantId,
        environmentId: ctx.input.environmentId
      });

      return storeTemplateDetailPresenter(
        await storeTemplateService.deleteStoreTemplate({
          ...scope,
          storeTemplateId: ctx.input.storeTemplateId
        })
      );
    })
});
