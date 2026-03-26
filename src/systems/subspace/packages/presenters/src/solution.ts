import type { Solution } from '@metorial-subspace/db';

export let solutionPresenter = (solution: Solution) => ({
  object: 'solution',

  id: solution.id,
  identifier: solution.identifier,
  name: solution.name,

  createdAt: solution.createdAt
});
