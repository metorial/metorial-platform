import { v } from '@lowerdeck/validation';
import { networkLogService } from '../services/networkLog';
import { app } from './_app';
import { tenantApp } from './tenant';

export let networkLogController = app.controller({
  list: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        enclaveIds: v.optional(v.array(v.string())),
        hostnames: v.optional(v.array(v.string())),
        ips: v.optional(v.array(v.string())),
        from: v.optional(v.string()),
        to: v.optional(v.string()),
        functionIds: v.optional(v.array(v.string())),
        intervalMinutes: v.optional(v.number())
      })
    )
    .do(
      async ctx =>
        await networkLogService.listNetworkLogs({
          tenantId: ctx.input.tenantId,
          enclaveIds: ctx.input.enclaveIds,
          hostnames: ctx.input.hostnames,
          ips: ctx.input.ips,
          from: ctx.input.from,
          to: ctx.input.to,
          functionIds: ctx.input.functionIds,
          intervalMinutes: ctx.input.intervalMinutes
        })
    )
});
