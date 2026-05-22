export let interpolateEnv = (
  env: Record<string, string>,
  hosts: Record<string, { host: string; port?: number }>
): Record<string, string> => {
  let result: Record<string, string> = {};

  for (let [key, value] of Object.entries(env)) {
    result[key] = value.replace(/\$deps\.([a-zA-Z0-9_-]+)(?:\.(\d+)|\.url)?/g, (match, name, port) => {
      let dep = hosts[name];
      if (!dep) throw new Error(`Unknown dependency "${name}" in env var ${key}=${value}`);
      if (match.endsWith('.url')) {
        return `http://${dep.host}:${port ?? dep.port ?? 80}`;
      }
      if (port) return `${dep.host}:${port}`;
      return dep.host;
    });
  }

  return result;
};

export let mergeEnv = (
  ...layers: Record<string, string>[]
): Record<string, string> => Object.assign({}, ...layers);
