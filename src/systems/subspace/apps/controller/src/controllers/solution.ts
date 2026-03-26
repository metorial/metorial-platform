import { v } from '@lowerdeck/validation';
import { solutionService } from '@metorial-subspace/module-tenant';
import { solutionPresenter } from '@metorial-subspace/presenters';
import { app, appWithoutSolution } from './_app';

export let solutionApp = appWithoutSolution.use(async ctx => {
  let solutionId = ctx.body.solutionId;
  if (!solutionId) throw new Error('Solution ID is required');

  let solution = await solutionService.getSolutionById({ id: solutionId });

  return { solution };
});

export let solutionController = app.controller({
  upsert: appWithoutSolution
    .handler()
    .input(
      v.object({
        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let solution = await solutionService.upsertSolution({
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return solutionPresenter(solution);
    }),

  get: solutionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        solutionId: v.string()
      })
    )
    .do(async ctx => solutionPresenter(ctx.solution))
});
