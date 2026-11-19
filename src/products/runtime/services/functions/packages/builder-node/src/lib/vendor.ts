import fs from 'fs/promises';
import path from 'path';
import semver from 'semver';
import { runCommand } from './runCommand';

export let defaultVendorDirectory = '/opt/function-bay/vendor';

export let npmMirrorHint =
  'Air-gapped installations need an npm mirror (Helm value `runtime.builds.npmRegistry.url`).';

let dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

let unsupportedSpecPattern =
  /^(file|link|workspace|portal|patch|npm|git|git\+[a-z]+|github|http|https):/i;

let distTagPattern = /^[a-z][a-z0-9._-]*$/i;

export type VendorManifest = {
  packages: Record<string, string>;
};

export type DependencyPackageJson = Partial<
  Record<(typeof dependencyFields)[number], Record<string, string>>
>;

export type DependencyInstallPlan =
  | { mode: 'vendor'; directory: string; packages: number }
  | { mode: 'install'; missing: string[] | null };

export let readVendorManifest = async (
  directory = defaultVendorDirectory
): Promise<VendorManifest | null> => {
  try {
    let manifest = JSON.parse(
      await fs.readFile(path.join(directory, 'manifest.json'), 'utf-8')
    ) as VendorManifest;

    return manifest?.packages && typeof manifest.packages == 'object' ? manifest : null;
  } catch {
    return null;
  }
};

let isCovered = (spec: string, version: string | undefined) => {
  if (version === undefined) return false;

  let trimmed = spec.trim();
  if (trimmed === '' || trimmed === '*') return true;
  if (unsupportedSpecPattern.test(trimmed) || trimmed.includes('/')) return false;

  if (semver.validRange(trimmed)) return semver.satisfies(version, trimmed);

  return distTagPattern.test(trimmed);
};

export let partitionDependencies = (
  packageJson: DependencyPackageJson,
  manifest: VendorManifest
) => {
  let covered = new Set<string>();
  let missing = new Set<string>();

  for (let field of dependencyFields) {
    for (let [name, spec] of Object.entries(packageJson[field] ?? {})) {
      if (isCovered(String(spec ?? ''), manifest.packages[name])) covered.add(name);
      else missing.add(name);
    }
  }

  for (let name of missing) covered.delete(name);

  return { covered: [...covered], missing: [...missing] };
};

export let planDependencyInstall = (d: {
  packageJson: DependencyPackageJson;
  manifest: VendorManifest | null;
  vendorDirectory?: string;
}): DependencyInstallPlan => {
  if (!d.manifest) return { mode: 'install', missing: null };

  let { missing } = partitionDependencies(d.packageJson, d.manifest);
  if (missing.length) return { mode: 'install', missing };

  return {
    mode: 'vendor',
    directory: d.vendorDirectory ?? defaultVendorDirectory,
    packages: Object.keys(d.manifest.packages).length
  };
};

export let describeMissingPackages = (missing: string[]) =>
  `These packages are not preinstalled: ${missing.join(', ')}. ${npmMirrorHint}`;

// The vendor directory is read-only, so packages are copied (not linked) and made writable for
// build scripts that write into node_modules.
export let installVendorPackages = async (d: { directory: string; cwd?: string }) => {
  let cwd = d.cwd ?? process.cwd();
  let target = path.join(cwd, 'node_modules');

  await fs.mkdir(target, { recursive: true });
  await runCommand('cp', ['-R', `${path.join(d.directory, 'node_modules')}/.`, `${target}/`]);
  await runCommand('chmod', ['-R', 'u+w', target]);
};
