import { ServiceError, validationError } from '@lowerdeck/error';

let reservedEnvNames = new Set(['NODE_OPTIONS', 'NODE_PATH', 'NODE_EXTRA_CA_CERTS']);
let reservedEnvPrefixes = ['LD_', 'METORIAL_', 'CLUSTER_MANAGER_', 'EGRESS_GATEWAY_'];

export let isReservedEnvName = (name: string) =>
  reservedEnvNames.has(name) || reservedEnvPrefixes.some(prefix => name.startsWith(prefix));

export let assertNoReservedEnv = (env: Record<string, string>) => {
  let reserved = Object.keys(env).filter(isReservedEnvName);
  if (!reserved.length) return;

  throw new ServiceError(
    validationError({
      entity: 'function.deployment',
      errors: reserved.map(name => ({
        code: 'reserved_env_name',
        message: `Environment variable ${name} is reserved by the runtime`,
        path: ['env', name]
      }))
    })
  );
};

export let dropReservedEnv = (env: Record<string, string>) => {
  let kept: Record<string, string> = {};
  let dropped: string[] = [];

  for (let [name, value] of Object.entries(env)) {
    if (isReservedEnvName(name)) dropped.push(name);
    else kept[name] = value;
  }

  return { env: kept, dropped };
};
