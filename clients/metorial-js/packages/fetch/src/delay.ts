export let delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));
