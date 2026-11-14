import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { enclavePresenter } from '../presenters/enclave';
import { enclaveService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let enclaveController = app.controller({
  upsert: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        id: v.optional(v.string()),
        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let enclave = await enclaveService.upsertEnclave({
        tenant: ctx.tenant,
        input: {
          id: ctx.input.id,
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return enclavePresenter(enclave);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await enclaveService.listEnclaves({
        tenantId: ctx.input.tenantId
      });
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, enclavePresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        enclaveId: v.string()
      })
    )
    .do(async ctx => {
      let enclave = await enclaveService.getEnclaveById({
        tenantId: ctx.input.tenantId,
        id: ctx.input.enclaveId
      });
      return enclavePresenter(enclave);
    })
});
