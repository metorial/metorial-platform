import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { enclavePresenter } from '../presenters/enclave';
import { enclaveService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let enclaveController = app.controller({
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
