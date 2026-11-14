import { v } from '@lowerdeck/validation';
import { coverageService } from '@mtsrc/agent-tracking-module-usage';
import { organizationApp } from './_app';
import { queryRangeSchema, queryScopeSchema } from './query';

export let coverageController = organizationApp.controller({
  get: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        scope: queryScopeSchema,
        range: queryRangeSchema
      })
    )
    .do(async ctx => {
      let coverage = await coverageService.getCoverage({
        organization: ctx.organization,
        scope: ctx.input.scope,
        range: ctx.input.range
      });

      return { object: 'agent_tracking#coverage', ...coverage };
    })
});
