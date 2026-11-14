import { describe, it } from 'vitest';
import { runsOn, type E2EEdition } from './edition';

type Editions = E2EEdition | readonly E2EEdition[];

/** Wrap a whole file in it to mark the file as specific to some editions. */
export let describeFor = (editions: Editions, name: string, fn: () => void) =>
  describe.skipIf(!runsOn(editions))(name, fn);

export let itFor = (
  editions: Editions,
  name: string,
  fn: () => void | Promise<void>,
  timeout?: number
) => it.skipIf(!runsOn(editions))(name, fn, timeout);

export let describeCloud = (name: string, fn: () => void) => describeFor('cloud', name, fn);

export let describeOnPrem = (name: string, fn: () => void) =>
  describeFor('on-prem', name, fn);

export let itCloud = (name: string, fn: () => void | Promise<void>, timeout?: number) =>
  itFor('cloud', name, fn, timeout);

export let itOnPrem = (name: string, fn: () => void | Promise<void>, timeout?: number) =>
  itFor('on-prem', name, fn, timeout);
