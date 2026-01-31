import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceSessionService } from '@metorial/module-subspace';
import { instanceGroup } from '../../middleware/instanceGroup';

export let subspaceSessionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.sessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'sessionId is required',
        description: 'The sessionId path parameter is required.'
      })
    );
  }

  let session = await subspaceSessionService.get({
    instance: ctx.instance,
    sessionId: ctx.params.sessionId
  });

  return { session };
});
