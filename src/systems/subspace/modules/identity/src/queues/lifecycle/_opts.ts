export let lcOpts = {
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
};
