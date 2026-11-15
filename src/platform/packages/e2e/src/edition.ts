export type E2EEdition = 'cloud' | 'on-prem';

export let e2eEditions: readonly E2EEdition[] = ['cloud', 'on-prem'];

export let e2eEdition = (): E2EEdition => {
  let value = process.env.METORIAL_E2E_EDITION ?? 'cloud';
  if (!e2eEditions.includes(value as E2EEdition)) {
    throw new Error(
      `METORIAL_E2E_EDITION must be one of ${e2eEditions.join(', ')}, got "${value}"`
    );
  }

  return value as E2EEdition;
};

export let runsOn = (editions: E2EEdition | readonly E2EEdition[]) =>
  (Array.isArray(editions) ? editions : [editions]).includes(e2eEdition());
