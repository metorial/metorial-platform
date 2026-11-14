let isDev = process.env.NODE_ENV !== 'production';

export let oauthDebug = (message: string, payload: Record<string, unknown>) => {
  if (!isDev) return;

  console.log(`[shuttle:oauth] ${message}`, JSON.stringify(payload));
};
