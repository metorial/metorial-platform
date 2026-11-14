import { getEdition } from '@metorial/editions';

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

let cached: { models: Promise<Models>; expiresAt: number } | null = null;
let timeout = 1000 * 60 * 15;
let failureTimeout = 1000 * 60;

let fetchModels = async (): Promise<{ models: Models; ok: boolean }> => {
  try {
    let res = await fetch('https://models.dev/api.json');
    if (!res.ok) return { models: {}, ok: false };
    return { models: (await res.json()) as Models, ok: true };
  } catch {
    return { models: {}, ok: false };
  }
};

export let getModels = async (): Promise<Models> => {
  // Installs without outbound access must not reach out for pricing data.
  if (getEdition() == 'on-prem') return {};

  if (cached && Date.now() < cached.expiresAt) {
    return cached.models;
  }

  let entry = { models: Promise.resolve({} as Models), expiresAt: Date.now() + failureTimeout };
  cached = entry;

  entry.models = fetchModels().then(result => {
    if (result.ok) entry.expiresAt = Date.now() + timeout;
    return result.models;
  });

  return entry.models;
};

export let getModelInfo = async (provider: string, model: string) => {
  let models = await getModels();
  return models[provider]?.models[model];
};
