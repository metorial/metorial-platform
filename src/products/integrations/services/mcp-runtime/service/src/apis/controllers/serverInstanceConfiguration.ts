import { v } from '@lowerdeck/validation';
import { serverInstanceConfigurationPresenter } from '../../presenters';
import { serverInstanceConfigurationService } from '../../services';
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

export let serverInstanceConfigurationController = app.controller({
  upsert: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverInstanceConfigurationId: v.optional(v.string()),
        enclaveId: v.string(),
        egressPolicy: egressPolicyValidator
      })
    )
    .do(async ctx => {
      let res = await serverInstanceConfigurationService.upsertServerInstanceConfiguration({
        tenant: ctx.tenant,
        serverInstanceConfigurationId: ctx.input.serverInstanceConfigurationId,
        enclaveId: ctx.input.enclaveId,
        egressPolicy: ctx.input.egressPolicy
      });

      return serverInstanceConfigurationPresenter(res);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        serverInstanceConfigurationId: v.string()
      })
    )
    .do(async ctx => {
      let res = await serverInstanceConfigurationService.getServerInstanceConfigurationById({
        tenant: ctx.tenant,
        serverInstanceConfigurationId: ctx.input.serverInstanceConfigurationId
      });

      return serverInstanceConfigurationPresenter(res);
    })
});
