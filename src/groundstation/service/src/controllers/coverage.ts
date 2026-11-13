import { v } from '@lowerdeck/validation';
import { coverageService } from '../coverage';
import { organizationApp } from './_app';
import { queryRangeSchema, queryScopeSchema } from './usage';

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

      return { object: 'groundstation#coverage', ...coverage };
    })
});
