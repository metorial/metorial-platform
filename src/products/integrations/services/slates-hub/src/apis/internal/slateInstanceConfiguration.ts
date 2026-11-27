import { v } from '@lowerdeck/validation';
import { slateInstanceConfigurationPresenter } from '../../presenters';
import { slateInstanceConfigurationService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

let egressPolicyValidator = v.object({
  direction: v.literal('egress'),
  entries: v.array(
    v.object({
      cidr: v.string(),
      portRange: v.optional(
        v.object({
          from: v.number(),
          to: v.number()
        })
      )
    })
  )
});

export let slateInstanceConfigurationController = app.controller({
  upsert: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateInstanceConfigurationId: v.optional(v.string()),
        enclaveId: v.string(),
        egressPolicy: egressPolicyValidator
      })
    )
    .do(async ctx => {
      let res = await slateInstanceConfigurationService.upsertSlateInstanceConfiguration({
        tenant: ctx.tenant,
        slateInstanceConfigurationId: ctx.input.slateInstanceConfigurationId,
        enclaveId: ctx.input.enclaveId,
        egressPolicy: ctx.input.egressPolicy
      });

      return slateInstanceConfigurationPresenter(res);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateInstanceConfigurationId: v.string()
      })
    )
    .do(async ctx => {
      let res = await slateInstanceConfigurationService.getSlateInstanceConfigurationById({
        tenant: ctx.tenant,
        slateInstanceConfigurationId: ctx.input.slateInstanceConfigurationId
      });

      return slateInstanceConfigurationPresenter(res);
    })
});
