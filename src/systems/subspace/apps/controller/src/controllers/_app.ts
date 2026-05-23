import { badRequestError, ServiceError } from '@mtsrc/error';
import { Group } from '@mtsrc/rpc-server';
import { solutionService } from '@metorial-subspace/module-tenant';

export let appWithoutSolution = new Group();

export let app = appWithoutSolution.use(async ctx => {
  let solutionId = ctx.headers.get('Subspace-Solution-Id');
  if (!solutionId)
    throw new ServiceError(
      badRequestError({ message: 'Subspace-Solution-Id header is required' })
    );

  return {
    solution: await solutionService.getSolutionById({ id: solutionId })
  };
});
