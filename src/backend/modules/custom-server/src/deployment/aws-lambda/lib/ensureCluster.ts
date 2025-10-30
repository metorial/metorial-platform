import { CreateClusterCommand } from '@aws-sdk/client-ecs';
import { awsEcs } from './aws';

let ensureClusterRaw = async (name: string) => {
  try {
    return await awsEcs.send(new CreateClusterCommand({ clusterName: name }));
  } catch (err: any) {
    if (!err.message.includes('already exists')) throw err;
  }
};

let clusterPromiseCache = new Map<string, ReturnType<typeof ensureClusterRaw>>();

export let ensureCluster = async (name: string) => {
  let promise = clusterPromiseCache.get(name);

  if (!promise) {
    promise = ensureClusterRaw(name);
    clusterPromiseCache.set(name, promise);
  }

  return await promise;
};
