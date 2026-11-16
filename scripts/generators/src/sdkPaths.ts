import type { Endpoint } from './fetch';

// Generated type, mapper and file names join the SDK path segments, so paths that differ only in
// where they are split (`consumer.devices` and `consumerDevices`) produce the same identifiers.
let toIdentifierKey = (sdkPath: string) => sdkPath.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

export let findSdkPathCollisions = (endpoints: Pick<Endpoint, 'allPaths'>[]) => {
  let sdkPathsByKey = new Map<string, Set<string>>();

  for (let endpoint of endpoints) {
    for (let { sdkPath } of endpoint.allPaths) {
      let key = toIdentifierKey(sdkPath);
      sdkPathsByKey.set(key, (sdkPathsByKey.get(key) ?? new Set()).add(sdkPath));
    }
  }

  return [...sdkPathsByKey.values()]
    .filter(sdkPaths => sdkPaths.size > 1)
    .map(sdkPaths => [...sdkPaths]);
};
