interface Models {
  [key: string]: {
    models: {
      [key: string]: {
        cost?: {
          cache_read?: number;
          cache_write?: number;
          input?: number;
          output?: number;
        };
        last_updated?: string;
        knowledge?: string;
        reasoning?: boolean;
        limit?: { context?: number; output?: number };
      };
    };
  };
}

let cached: { models: Promise<Models>; ts: number } | null = null;
let timeout = 1000 * 60 * 15;

export let getModels = async () => {
  if (cached && Date.now() - cached.ts < timeout) {
    return cached.models;
  }

  cached = {
    models: fetch('https://models.dev/api.json').then(res => res.json()),
    ts: Date.now()
  };

  return cached.models;
};

export let getModelInfo = async (provider: string, model: string) => {
  let models = await getModels();
  return models[provider]?.models[model];
};
