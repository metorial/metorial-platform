import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { within } from './files';
import { applies, dependencyClosure, discover } from './manifest';
import { discoverPackages, globMatch, relativePath } from './packages';
import { infrastructureImages } from './e2e';
import type { ProjectRoot } from './types';

export let inventory = (project: ProjectRoot) => {
  let manifests = discover(project.root);
  let packages = discoverPackages(project.root);
  let applicable = manifests.filter(item => applies(item.manifest, project.kind));
  let images: Record<string, unknown>[] = [];

  let names = new Set<string>();
  let destinations = new Set<string>();
  let owners = new Map<string, string[]>();
  let relative = (path: string) => {
    if (!within(project.root, path)) throw new Error(`CI path escapes checkout: ${path}`);

    return relativePath(project.root, path);
  };

  for (let loaded of manifests) {
    let base = dirname(loaded.path);
    let packageName = loaded.manifest.package?.name ?? '';

    for (let image of loaded.manifest.ci.images) {
      if (!/^[a-z0-9-]+$/.test(image.name) || names.has(image.name))
        throw new Error(
          `duplicate or invalid CI image identifier ${JSON.stringify(image.name)}`
        );
      names.add(image.name);

      if (!['enterprise', 'oss', 'horizon', 'external'].includes(image.group))
        throw new Error(`invalid CI image group ${JSON.stringify(image.group)}`);

      if (image.platform !== 'linux/amd64')
        throw new Error(
          `unsupported backend image platform ${JSON.stringify(image.platform)}`
        );

      if ((image.group === 'external') !== (image.source !== undefined) || image.source === '')
        throw new Error(
          'CI external images require a source and application images require a Dockerfile'
        );

      let workspace =
        image.workspace ??
        (within(project.oss, base) && project.oss !== project.root ? 'oss' : '.');
      let workspacePath = resolve(project.root, workspace);
      relative(workspacePath);

      if (!existsSync(workspacePath) || !statSync(workspacePath).isDirectory())
        throw new Error(`missing CI workspace ${workspacePath}`);

      let dockerfile = '';
      if (image.source === undefined) {
        let path = resolve(base, image.dockerfile ?? 'Dockerfile');
        if (!existsSync(path) || !statSync(path).isFile())
          throw new Error(`missing CI Dockerfile ${path}`);
        dockerfile = relative(path);
      }

      let repository = image.image ?? `metorial/mte-${image.name}`;
      if (destinations.has(repository))
        throw new Error(`duplicate CI image destination ${repository}`);
      destinations.add(repository);
      owners.set(packageName, [...(owners.get(packageName) ?? []), image.name]);

      images.push({
        name: image.name,
        group: image.group,
        package: packageName,
        dockerfile,
        workspace: workspace === '.' ? '.' : `./${workspace}`,
        image: repository,
        ecr: image.ecr ?? `metorial-enterprise-saas/mte-${image.name}`,
        canonical: image.canonical ?? '',
        source: image.source ?? null,
        platform: image.platform,
        stagingOnly: image.stagingOnly,
        tested: loaded.manifest.e2e.image !== undefined,
        manifest: relative(loaded.path)
      });
    }
  }

  let suites: Record<string, unknown>[] = [];
  let suiteNames = new Set<string>();
  let testOwners = new Set<string>();

  for (let loaded of applicable) {
    let packageName = loaded.manifest.package?.name ?? '';
    let config =
      loaded.manifest.ci.suite ??
      (loaded.manifest.e2e.tests.length
        ? {
            name: packageName.replace(/^@+/, '').replaceAll('/', '-'),
            runner: 'control',
            groups: 2,
            workspacePackages: [],
            profiles: []
          }
        : undefined);
    if (!config) continue;

    if (!/^[a-z0-9-]+$/.test(config.name) || suiteNames.has(config.name))
      throw new Error(`duplicate CI suite ${config.name}`);
    suiteNames.add(config.name);

    if (!['control', 'compose'].includes(config.runner) || config.groups === 0)
      throw new Error('invalid CI test runner or group count');

    let base = dirname(loaded.path);
    let roots = [
      loaded,
      ...loaded.manifest.e2e.services.map(name => {
        let found = applicable.find(item => item.manifest.package?.name === name);
        if (!found) throw new Error(`unknown E2E service ${name}`);

        return found;
      })
    ];
    let services = [
      ...new Set(
        [...roots, ...dependencyClosure(manifests, roots, project.kind)].flatMap(item =>
          item.manifest.package ? [item.manifest.package.name] : []
        )
      )
    ].sort();
    let requiredImages = new Set<string>();

    let manifestPaths = new Set<string>();

    for (let name of services) {
      for (let image of owners.get(name) ?? []) requiredImages.add(image);

      let dependency = applicable.find(item => item.manifest.package?.name === name)!;
      manifestPaths.add(relative(dependency.path));

      if (
        project.kind === 'enterprise' &&
        config.runner === 'control' &&
        !dependency.manifest.e2e.image
      )
        throw new Error(`runtime E2E service ${name} has no test image mapping`);

      let image = dependency.manifest.e2e.image;
      if (
        image &&
        (owners.has(name) || project.kind === 'enterprise') &&
        !owners.get(name)?.includes(image)
      )
        throw new Error(
          `E2E image ${JSON.stringify(image)} for ${name} has no matching CI image metadata`
        );
    }

    let tests: { name: string; directory: string }[] = [];
    if (config.runner === 'compose')
      tests.push({ name: packageName, directory: relative(base) });
    else
      for (let pattern of loaded.manifest.e2e.tests) {
        let path = resolve(base, pattern);
        let matched = packages.filter(item => globMatch(path, item.directory));
        if (!matched.length) throw new Error(`E2E glob matches no packages: ${path}`);

        for (let item of matched.filter(item => item.scripts.has('test:e2e'))) {
          if (testOwners.has(item.name))
            throw new Error(`duplicate CI test owner ${item.name}`);
          testOwners.add(item.name);
          tests.push({ name: item.name, directory: relative(item.directory) });
        }
      }

    if (!tests.length) throw new Error(`CI suite ${config.name} has no tests`);

    for (let extra of config.workspacePackages)
      if (!packages.some(item => item.name === extra))
        throw new Error(`unknown test workspace dependency ${extra}`);
    suites.push({
      name: config.name,
      package: packageName,
      runner: config.runner,
      groups: config.groups,
      workspacePackages: config.workspacePackages,
      profiles: config.profiles,
      directory: relative(base),
      workspace: config.runner === 'compose' && project.oss !== project.root ? './oss' : '.',
      services,
      images: [...requiredImages].sort(),
      manifests: [...manifestPaths].sort(),
      tests
    });
  }

  let sortByName = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    String(a.name) < String(b.name) ? -1 : String(a.name) > String(b.name) ? 1 : 0;

  return {
    version: 1,
    images: images.sort(sortByName),
    suites: suites.sort(sortByName),
    infrastructure: infrastructureImages
  };
};
