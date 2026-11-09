import type { LoadedManifest, Manifest, RootKind } from '../types';

export let buildable = (manifest: Manifest) =>
  manifest.ci.dockerfiles.length > 0 ||
  manifest.ci.images.some(image => image.build || image.dockerfile);

export let hasProductionSource = (manifest: Manifest, id: string) => {
  let production = manifest.stacks[id]?.production;

  return !!(production && (production.image || production.dockerfile || buildable(manifest)));
};

export let validateStacks = (manifests: LoadedManifest[]) => {
  let definitions = new Map<string, string>();

  for (let loaded of manifests)
    for (let definition of loaded.manifest.stack_definitions) {
      if (definitions.has(definition.id))
        throw new Error(
          `${loaded.path}: stack ${JSON.stringify(definition.id)} is already defined in ${definitions.get(definition.id)}`
        );
      definitions.set(definition.id, loaded.path);
    }

  let startable = new Set(
    manifests
      .filter(loaded => Object.keys(loaded.manifest.run).length > 0)
      .map(loaded => loaded.manifest.package?.name)
  );
  let members = new Map<string, Map<string, LoadedManifest>>();

  for (let loaded of manifests)
    for (let id of Object.keys(loaded.manifest.stacks)) {
      if (!definitions.has(id)) continue;

      let name = loaded.manifest.package!.name;
      if (!members.has(id)) members.set(id, new Map());
      members.get(id)!.set(name, loaded);

      let { manifest } = loaded;
      let member = manifest.stacks[id]!;
      if (!member.production.disabled && !hasProductionSource(manifest, id))
        throw new Error(
          `${loaded.path}: stack ${JSON.stringify(id)} has no production image; add a ci build spec, production.image or production.dockerfile, or set production: false`
        );
    }

  for (let [id, packages] of members) {
    for (let [name, loaded] of packages)
      for (let dependency of loaded.manifest.dependencies.filter(
        item => item.start && startable.has(item.identifier)
      ))
        if (!packages.has(dependency.identifier))
          throw new Error(
            `${loaded.path}: ${name} depends on ${dependency.identifier}, which is not a member of stack ${JSON.stringify(id)}`
          );

    for (let kind of ['oss', 'enterprise'] as RootKind[]) {
      let ports = new Map<number, string>();

      for (let [name, loaded] of packages) {
        if (loaded.manifest.mode !== 'both' && loaded.manifest.mode !== kind) continue;

        let memberMode = loaded.manifest.stacks[id]!.mode;
        if (memberMode !== 'both' && memberMode !== kind) continue;

        for (let endpoint of Object.values(loaded.manifest.endpoints)) {
          let owner = ports.get(endpoint.port);
          if (owner && owner !== name)
            throw new Error(
              `stack ${JSON.stringify(id)} (${kind}): port ${endpoint.port} is used by both ${owner} and ${name}`
            );
          ports.set(endpoint.port, name);
        }
      }
    }
  }
};
