let SESSIONLESS_DEFAULT_ENVIRONMENTS = ['development', 'staging'];

export let getDefaultSessionlessMcpEnabled = () => {
  let metorialEnv = process.env.METORIAL_ENV;
  if (metorialEnv) return SESSIONLESS_DEFAULT_ENVIRONMENTS.includes(metorialEnv);

  return process.env.NODE_ENV !== 'production';
};

export let resolveSessionlessMcpEnabled = (configured: boolean | null | undefined) =>
  configured ?? getDefaultSessionlessMcpEnabled();
