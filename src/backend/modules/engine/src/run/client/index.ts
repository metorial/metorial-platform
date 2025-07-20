import { delay } from '@metorial/delay';
import { murmur3_32 } from '@metorial/murmur3';
import { getManagers, Manager } from './managers';

let getClientByIndex = (index: number) => {
  let managers = getManagers();

  for (let i = 0; i < managers.length; i++) {
    let currentIndex = (index + i) % managers.length;
    let manager = managers[currentIndex];
    if (manager.enabled) return manager.client;
  }

  return null;
};

export let getClientByHash = (hash: string) => {
  let murmur3 = murmur3_32(hash);
  let managers = getManagers();

  return getClientByIndex(murmur3 % managers.length);
};

let offset = 0;
export let getRandomClient = () => {
  let managers = getManagers();
  if (managers.length === 0) return null;

  return getClientByIndex(++offset % managers.length);
};

let MUST_GET_MAX_ATTEMPTS = 10;
export let mustGetClient = async (
  provider: () => Manager['client'] | null | Promise<Manager['client'] | null>
) => {
  let attempts = 0;

  while (attempts < MUST_GET_MAX_ATTEMPTS) {
    let client = await provider();
    if (client) return client;

    attempts++;

    await delay(Math.min(1000 * attempts, 5000));
  }

  return null;
};
