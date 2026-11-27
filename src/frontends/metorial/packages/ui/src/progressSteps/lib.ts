export type ProgressStepState = 'complete' | 'active' | 'pending' | 'failed';

export let getProgressStepStates = <Id extends string>(
  stepIds: readonly Id[],
  currentId: Id | null | undefined,
  outcome?: 'complete' | 'failed'
): Record<Id, ProgressStepState> => {
  let currentIndex = currentId ? stepIds.indexOf(currentId) : -1;
  let states = {} as Record<Id, ProgressStepState>;

  stepIds.forEach((id, index) => {
    if (outcome == 'complete') {
      states[id] = 'complete';
    } else if (index < currentIndex) {
      states[id] = 'complete';
    } else if (index == currentIndex) {
      states[id] = outcome == 'failed' ? 'failed' : 'active';
    } else {
      states[id] = 'pending';
    }
  });

  return states;
};
