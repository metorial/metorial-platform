let SESSIONLESS_ENVIRONMENTS = ['development', 'staging'];

export let isSessionlessMcpEnabled = () => {
  let metorialEnv = process.env.METORIAL_ENV;
  if (metorialEnv) return SESSIONLESS_ENVIRONMENTS.includes(metorialEnv);

  return process.env.NODE_ENV !== 'production';
};
