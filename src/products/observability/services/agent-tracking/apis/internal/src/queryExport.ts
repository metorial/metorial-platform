import { v } from '@lowerdeck/validation';
import { maxListedExports, queryExportService } from '@mtsrc/agent-tracking-module-query';
import { organizationApp } from './_app';
import { queryScopeSchema } from './query';

export let queryExportController = organizationApp.controller({
  create: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        scope: queryScopeSchema,
        query: v.record(v.any()),
        format: v.optional(v.enumOf(['csv', 'ndjson'])),
        createdBy: v.optional(v.string({ modifiers: [v.maxLength(200)] }))
      })
    )
    .do(async ctx =>
      queryExportService.createQueryExport({
        organization: ctx.organization,
        scope: ctx.input.scope,
        query: ctx.input.query,
        format: ctx.input.format ?? 'csv',
        ...(ctx.input.createdBy ? { createdBy: ctx.input.createdBy } : {})
      })
    ),

  get: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), exportId: v.string() }))
    .do(async ctx =>
      queryExportService.getQueryExport({
        organization: ctx.organization,
        exportId: ctx.input.exportId
      })
    ),

  list: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        limit: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(maxListedExports)] })
        )
      })
    )
    .do(async ctx =>
      queryExportService.listQueryExports({
        organization: ctx.organization,
        ...(ctx.input.limit ? { limit: ctx.input.limit } : {})
      })
    ),

  cancel: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), exportId: v.string() }))
    .do(async ctx =>
      queryExportService.cancelQueryExport({
        organization: ctx.organization,
        exportId: ctx.input.exportId
      })
    )
});
