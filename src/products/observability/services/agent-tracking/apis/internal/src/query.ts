import { v } from '@lowerdeck/validation';
import {
  maxValuesLimit,
  queryCatalogService,
  queryService,
  queryValuesService
} from '@mtsrc/agent-tracking-module-query';
import { datasetNames } from '@mtsrc/agent-tracking-query-spec';
import { organizationApp } from './_app';

export let queryScopeSchema = v.optional(
  v.object({
    projectIds: v.optional(v.array(v.string(), { modifiers: [v.maxLength(100)] })),
    instanceIds: v.optional(v.array(v.string(), { modifiers: [v.maxLength(100)] }))
  })
);

export let queryRangeSchema = v.object({ from: v.date(), to: v.date() });

let queryInput = v.object({
  organizationId: v.string(),
  scope: queryScopeSchema,
  query: v.record(v.any())
});

export let queryController = organizationApp.controller({
  run: organizationApp
    .handler()
    .input(queryInput)
    .do(async ctx =>
      queryService.run({
        organization: ctx.organization,
        scope: ctx.input.scope,
        query: ctx.input.query
      })
    ),

  validate: organizationApp
    .handler()
    .input(queryInput)
    .do(async ctx => ({
      object: 'agent_tracking#query_validation',
      ...(await queryService.validate({
        organization: ctx.organization,
        scope: ctx.input.scope,
        query: ctx.input.query
      }))
    })),

  explain: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        scope: queryScopeSchema,
        query: v.record(v.any()),
        includePipelines: v.optional(v.boolean())
      })
    )
    .do(async ctx => ({
      object: 'agent_tracking#query_explain',
      ...(await queryService.explain({
        organization: ctx.organization,
        scope: ctx.input.scope,
        query: ctx.input.query,
        includePipelines: ctx.input.includePipelines
      }))
    })),

  catalog: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        dataset: v.optional(v.enumOf([...datasetNames]))
      })
    )
    .do(async ctx =>
      queryCatalogService.getCatalog({
        organization: ctx.organization,
        dataset: ctx.input.dataset
      })
    ),

  values: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        scope: queryScopeSchema,
        dataset: v.enumOf([...datasetNames]),
        field: v.string({ modifiers: [v.minLength(1), v.maxLength(200)] }),
        search: v.optional(v.string({ modifiers: [v.maxLength(200)] })),
        range: v.optional(v.record(v.any())),
        limit: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(maxValuesLimit)] })
        )
      })
    )
    .do(async ctx =>
      queryValuesService.listValues({
        organization: ctx.organization,
        scope: ctx.input.scope,
        dataset: ctx.input.dataset,
        field: ctx.input.field,
        search: ctx.input.search,
        range: ctx.input.range as any,
        limit: ctx.input.limit
      })
    )
});
