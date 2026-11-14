import { Axiom } from '@axiomhq/js';

let axiom: Axiom | undefined = undefined;
let dataset: string | undefined = undefined;

export let initLogger = (opts: { token: string; dataset: string }) => {
  axiom = new Axiom({
    token: opts.token
  });

  dataset = opts.dataset;
};

let log = (data: object) => {
  if (!axiom || !dataset) {
    console.log('[LOGGER]', JSON.stringify(data, null, 2));
  } else {
    axiom.ingest(dataset, data);
  }
};

export let Logger = {
  raw: (data: object) => {
    log(data);
  },

  info: (message: string | object, data: object) => {
    let entireData = typeof message === 'string' ? { message, ...data } : message;

    log({
      level: 'info',
      ...entireData
    });
  },

  error: (message: string | object, data: object) => {
    let entireData = typeof message === 'string' ? { message, ...data } : message;

    log({
      level: 'error',
      ...entireData
    });
  }
};
