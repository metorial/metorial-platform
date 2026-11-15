import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { ssoScimLogPresenter } from '../../presenters';
import { ssoDirectorySyncService } from '../../../../services/sso/directorySync';
import { tenantApp } from './_middleware';

export let ssoScimLogsController = tenantApp.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          directoryIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ({ input, tenant }) => {
      let paginator = await ssoDirectorySyncService.listScimOperations({
        tenant,
        filters: { directoryIds: input.directoryIds }
      });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoScimLogPresenter);
    })
});
