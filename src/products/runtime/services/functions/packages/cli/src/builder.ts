export let BUILDER_NAME = '@function-bay/nodejs';

let getBuildLayerProvider = (raw: string | undefined) => {
  try {
    return JSON.parse(raw ?? '{}').provider as string | undefined;
  } catch {
    return undefined;
  }
};

export let resolvePreinstalledBuilder = (
  d: {
    env?: Record<string, string | undefined>;
    resolve?: (name: string) => string;
  } = {}
) => {
  let env = d.env ?? process.env;
  if (env.METORIAL_FUNCTION_BAY_BUILDER_PATH) return env.METORIAL_FUNCTION_BAY_BUILDER_PATH;
  if (getBuildLayerProvider(env.METORIAL_FUNCTION_BAY_BUILD_LAYER) !== 'knative')
    return undefined;

  try {
    return (d.resolve ?? require.resolve)(BUILDER_NAME);
  } catch {
    return undefined;
  }
};
