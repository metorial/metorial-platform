import { delay } from '@mtsrc/delay';
import { ProgrammablePromise } from '@mtsrc/programmable-promise';
import { createCargoClient } from '@metorial-platform-systems/cargo-client';
import { createSubspaceControllerClient } from '@metorial-platform-systems/subspace-client';
import { createSynthesisClient } from '@metorial-platform-systems/synthesis-client';
import { env } from './env';

export let cargo = createCargoClient({
  endpoint: env.service.CARGO_API_URL
});

let solutionProm = new ProgrammablePromise<
  Awaited<ReturnType<typeof subspace.solution.upsert>>
>();

export let getSubspaceSolution = () => solutionProm.promise;

export let subspace: ReturnType<typeof createSubspaceControllerClient> =
  createSubspaceControllerClient({
    getHeaders: async () => ({
      'Subspace-Solution-Id': (await solutionProm.promise).id
    }),
    endpoint: env.subspace.SUBSPACE_URL
  });

export let synthesis = createSynthesisClient({
  endpoint: env.service.SYNTHESIS_API_URL
});

(async () => {
  let client = createSubspaceControllerClient({
    endpoint: env.subspace.SUBSPACE_URL
  });

  let retryDelay = 500;

  while (true) {
    try {
      let solution = await client.solution.upsert({
        name: 'Metorial Platform',
        identifier: env.subspace.SUBSPACE_SOLUTION
      });
      solutionProm.resolve(solution);
      return;
    } catch (error) {
      console.log('Failed to create subspace solution ... retrying', error);
    }

    await delay(retryDelay);
    retryDelay = Math.min(retryDelay * 2, 5000);
  }
})();
