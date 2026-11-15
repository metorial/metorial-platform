import { v } from '@lowerdeck/validation';
import { recordPresenter } from '../presenters';
import { recordService, tenantService } from '../services';
import { app } from './_app';
import { indexApp } from './_index';
import { tenantApp } from './tenant';

export let recordApp = tenantApp.use(async ctx => {
  let recordId = ctx.body.recordId;
  if (!recordId) throw new Error('Record ID is required');

  let record = await recordService.getRecordById({ id: recordId, tenant: ctx.tenant });

  return { record };
});

export let recordController = app.controller({
  index: indexApp
    .handler()
    .input(
      v.object({
        sourceId: v.string(),
        indexId: v.string(),

        documentId: v.string(),
        tenantIds: v.optional(v.array(v.string())),
        fields: v.record(v.any()),
        body: v.union([v.string(), v.record(v.any())]),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let record = await recordService.indexRecord({
        index: ctx.index,
        input: {
          documentId: ctx.input.documentId,
          tenantIds: ctx.input.tenantIds,
          fields: ctx.input.fields,
          body: ctx.input.body,
          metadata: ctx.input.metadata
        }
      });
      return recordPresenter(record);
    }),

  delete: indexApp
    .handler()
    .input(
      v.object({
        sourceId: v.string(),
        indexId: v.string(),

        documentIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      await recordService.deleteRecords({
        index: ctx.index,
        documentIds: ctx.input.documentIds
      });

      return { success: true };
    }),

  get: recordApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        recordId: v.string()
      })
    )
    .do(async ctx => recordPresenter(ctx.record)),

  search: indexApp
    .handler()
    .input(
      v.object({
        tenantId: v.optional(v.string()),
        sourceId: v.string(),
        indexId: v.string(),

        query: v.string(),
        filters: v.optional(v.record(v.any()))
      })
    )
    .do(async ctx => {
      let tenant = ctx.input.tenantId
        ? await tenantService.getTenantByIdSafe({ id: ctx.input.tenantId })
        : undefined;

      let res = await recordService.searchRecords({
        tenant,
        index: ctx.index,
        query: ctx.input.query,
        filters: ctx.input.filters
      });

      return res.map(recordPresenter);
    })
});
