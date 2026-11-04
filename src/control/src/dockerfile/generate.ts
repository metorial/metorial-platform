import { existsSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { atomicWrite } from '../files';
import { discover } from '../manifest';
import { discoverPackages } from '../packages';
import type { LoadedManifest, ProjectRoot } from '../types';
import * as components from './components';
import type { BuildSpec, RenderContext } from './types';

export interface GeneratedDockerfile {
  image: string;
  path: string;
  contents: string;
}

export interface GenerateResult {
  files: GeneratedDockerfile[];
  changed: string[];
}

let workspaceOf = (project: ProjectRoot, loaded: LoadedManifest, workspace?: string) =>
  resolve(
    project.root,
    workspace ??
      (project.oss !== project.root && loaded.directory.startsWith(project.oss) ? 'oss' : '.')
  );

export let renderDockerfile = (
  workspace: string,
  packages: { name: string; directory: string }[],
  loaded: LoadedManifest,
  build: BuildSpec
): string => {
  let prefix = existsSync(resolve(workspace, 'oss/package.json')) ? 'oss/' : '';
  let packageName = loaded.manifest.package?.name;
  if (!packageName) throw new Error(`${loaded.path} has a build spec but no package`);

  let context: RenderContext = {
    build,
    packageName,
    packageDirectory: relative(workspace, loaded.directory),
    tooling: `${prefix}src/tooling`,
    runtime: `${prefix}src/control/runtime`,
    schemas: Object.fromEntries(
      build.migrations.map(migration => {
        let owner = packages.find(item => item.name === migration.package);
        if (!owner) throw new Error(`unknown migration package ${migration.package}`);

        let path = resolve(owner.directory, migration.path);
        if (!existsSync(path)) throw new Error(`missing migration schema ${path}`);

        let directory = statSync(path).isDirectory();

        return [
          migration.name,
          {
            source: relative(workspace, path),
            target: `prisma/${migration.name}/${directory ? 'schema' : 'schema.prisma'}`,
            directory
          }
        ] as const;
      })
    )
  };

  return components.join([
    components.header(),
    components.base(context),
    components.pruner(context),
    components.dependencies(context),
    components.builder(context),
    ...(build.modules === 'production' ? [components.productionDependencies()] : []),
    ...(build.migrations.length
      ? [components.controlRuntime(context), components.prismaCli()]
      : []),
    components.runnerBase(context),
    ...(build.migrations.length ? [components.tools()] : []),
    components.runner(context)
  ]);
};

export let generate = (
  project: ProjectRoot,
  options: { write: boolean },
  manifests: LoadedManifest[] = discover(project.root)
): GenerateResult => {
  let packages = discoverPackages(project.root);
  let files: GeneratedDockerfile[] = [];
  let changed: string[] = [];

  for (let loaded of manifests) {
    let targets = [
      ...loaded.manifest.ci.images.flatMap(image =>
        image.build ? [{ ...image, image: image.name, build: image.build }] : []
      ),
      ...loaded.manifest.ci.dockerfiles.map(item => ({
        ...item,
        image: loaded.manifest.package?.name ?? loaded.path
      }))
    ];

    for (let target of targets) {
      let workspace = workspaceOf(project, loaded, target.workspace);
      let path = resolve(loaded.directory, target.dockerfile ?? 'Dockerfile');
      let contents = renderDockerfile(workspace, packages, loaded, target.build);
      files.push({ image: target.image, path, contents });

      let current = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
      if (current === contents) continue;

      changed.push(path);
      if (options.write) atomicWrite(path, contents);
    }
  }

  return { files, changed };
};
