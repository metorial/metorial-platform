let packageShardPrefix = '--package-shard=';

/**
 * Turbo gives every package of a run the same arguments and environment, so CI addresses one
 * package's Vitest shard as `<package>=<index>/<count>`: in `METORIAL_E2E_PACKAGE_SHARDS`
 * (space separated, set by the e2e runner) or as a `--package-shard=` argument. Other packages
 * ignore it.
 */
export let resolvePackageShardArgs = (
  args: string[],
  packageName: string,
  environmentShards = process.env.METORIAL_E2E_PACKAGE_SHARDS ?? ''
) => {
  let specs = [
    ...environmentShards.split(/\s+/).filter(Boolean),
    ...args
      .filter(arg => arg.startsWith(packageShardPrefix))
      .map(arg => arg.slice(packageShardPrefix.length))
  ];
  let rest = args.filter(arg => !arg.startsWith(packageShardPrefix));

  let shard: string | undefined;
  for (let spec of specs) {
    let separator = spec.lastIndexOf('=');
    if (separator <= 0 || !/^\d+\/\d+$/.test(spec.slice(separator + 1))) {
      throw new Error(`Invalid package shard: ${spec}`);
    }
    if (spec.slice(0, separator) === packageName) shard = spec.slice(separator + 1);
  }

  return shard ? [...rest, `--shard=${shard}`, '--passWithNoTests'] : rest;
};
