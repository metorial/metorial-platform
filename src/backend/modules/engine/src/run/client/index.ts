import { murmur3_32 } from '@metorial/murmur3';
import { getManagers } from './managers';

export let getClientByHash = (hash: string) => {
  let murmur3 = murmur3_32(hash);
  let managers = getManagers();

  let index = murmur3 % managers.length;

  for (let i = 0; i < managers.length; i++) {
    let currentIndex = (index + i) % managers.length;
    let manager = managers[currentIndex];
    if (manager.enabled) return manager.client;
  }

  return null;
};
