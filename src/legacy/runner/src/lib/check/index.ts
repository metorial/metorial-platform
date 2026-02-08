import { $ } from 'bun';

export let checkRunnerMachine = async () => {
  // Deno must be installed
  try {
    await $`deno --version`.throws(true).quiet();
  } catch (e: any) {
    console.error('Deno is not installed. Please install Deno on this machine.');
    return false;
  }

  // Docker must be installed
  try {
    await $`docker --version`.throws(true).quiet();
  } catch (e: any) {
    console.error('Docker is not installed. Please install Docker on this machine.');
    return false;
  }

  // Docker must be running
  try {
    await $`docker info`.throws(true).quiet();
  } catch (e: any) {
    console.error('Docker is not running. Please start Docker on this machine.');
    return false;
  }

  return true;
};
