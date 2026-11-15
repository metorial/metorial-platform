let packageShardPrefix = '--package-shard=';

/**
 * Turbo passes the same arguments to every package of a run, so CI addresses one package's
 * Vitest shard as `--package-shard=<package>=<index>/<count>`. Other packages drop the argument.
 */
export let resolvePackageShardArgs = (args: string[], packageName: string) => {
  let shard: string | undefined;
  let rest = args.filter(arg => {
    if (!arg.startsWith(packageShardPrefix)) return true;

    let spec = arg.slice(packageShardPrefix.length);
    let separator = spec.lastIndexOf('=');
    if (separator <= 0 || !/^\d+\/\d+$/.test(spec.slice(separator + 1))) {
      throw new Error(`Invalid ${packageShardPrefix} argument: ${arg}`);
    }
    if (spec.slice(0, separator) === packageName) shard = spec.slice(separator + 1);
    return false;
  });

  return shard ? [...rest, `--shard=${shard}`, '--passWithNoTests'] : rest;
};
