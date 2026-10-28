import { copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { basename, dirname, join, resolve as resolvePath } from 'node:path';
import { canonical, readJson, sortedEntries, within, writeJson } from './files';
import { discover, refreshDependencyEndpoints, validateDependencyEndpoints } from './manifest';
import * as commands from './process';
import { detect } from './root';
import { parse, workspaceMetadataSchema } from './schema';
import type { LoadedManifest, ProjectRoot, ServicePorts, WorkspaceMetadata } from './types';

let standardPorts = [32379, 32380, 32707, 34222, 35432, 36379];

export let validateBranch = (branch: string) => {
  if (
    !branch ||
    branch.startsWith('-') ||
    branch.includes('..') ||
    /[ ~^:?*\[\\]/.test(branch) ||
    /[./]$/.test(branch) ||
    branch.includes('//')
  )
    throw new Error(`invalid git branch name ${JSON.stringify(branch)}`);
};

export let branchSlug = (branch: string) =>
  branch.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '');

export let workspaceId = (branch: string) =>
  branchSlug(branch)
    .toLowerCase()
    .replaceAll('_', '-')
    .slice(0, 45)
    .replace(/^-+|-+$/g, '') || 'workspace';

export let workspaceHostname = (branch: string) => `metorial-${workspaceId(branch)}.localhost`;

export let workspacePath = (root: string, branch: string) =>
  join(dirname(root), `${basename(root)}-${branchSlug(branch)}`);

export let metadataIfPresent = (root: string): WorkspaceMetadata | undefined => {
  let path = join(root, '.control/workspace.json');
  if (!existsSync(path)) return;

  let raw = parse(workspaceMetadataSchema, readJson(path), `invalid ${path}`);
  let data: WorkspaceMetadata = {
    ...raw,
    runtime: raw.runtime ?? 'docker',
    endpoint_ports: raw.endpoint_ports ?? {}
  };
  return data;
};

export let writeMetadata = (root: string, data: WorkspaceMetadata) =>
  writeJson(join(root, '.control/workspace.json'), {
    id: data.id,
    hostname: data.hostname,
    branch: data.branch,
    source_root: data.source_root,
    runtime: data.runtime,
    ...(data.service_ports ? { service_ports: data.service_ports } : {}),
    ...(Object.keys(data.endpoint_ports).length ? { endpoint_ports: data.endpoint_ports } : {})
  });

export interface GitWorktree {
  path: string;
  branch?: string;
  prunable: boolean;
}

export let parseWorktreeList = (text: string): GitWorktree[] => {
  let result: GitWorktree[] = [];
  let current: GitWorktree | undefined;

  for (let line of [...text.split('\n'), '']) {
    if (line.startsWith('worktree ')) {
      if (current) result.push(current);
      current = { path: line.slice(9), prunable: false };
    } else if (!line) {
      if (current) result.push(current);
      current = undefined;
    } else if (current && line.startsWith('branch refs/heads/'))
      current.branch = line.slice(18);
    else if (current && line.startsWith('prunable')) current.prunable = true;
  }

  return result;
};

export let listWorktrees = async (repo: string) =>
  parseWorktreeList(await commands.output('git', ['worktree', 'list', '--porcelain'], repo));

export let sourceRoot = async (project: ProjectRoot) => {
  let data = metadataIfPresent(project.root);
  if (data) return data.source_root;

  try {
    let common = canonical(
      resolvePath(
        project.root,
        await commands.output('git', ['rev-parse', '--git-common-dir'], project.root)
      )
    );
    if (basename(common) === '.git' && existsSync(join(dirname(common), 'package.json')))
      return dirname(common);
  } catch {}

  return project.root;
};

export let allocatePortValues = async (
  reserved: Set<number>,
  count: number
): Promise<number[]> => {
  let listeners: Server[] = [];
  let allocated: number[] = [];

  try {
    for (let port = 30000; port < 60000 && allocated.length < count; port++) {
      if (reserved.has(port)) continue;

      let listener = createServer();
      let available = await new Promise<boolean>(resolve => {
        listener.once('error', () => resolve(false));
        listener.listen(port, '127.0.0.1', () => resolve(true));
      });
      if (available) {
        listeners.push(listener);
        allocated.push(port);
      }
    }

    if (allocated.length !== count)
      throw new Error(`could not allocate ${count} conflict-free endpoint ports`);

    return allocated;
  } finally {
    await Promise.all(
      listeners.map(listener => new Promise<void>(resolve => listener.close(() => resolve())))
    );
  }
};

let reserve = (ports: Set<number>, data: WorkspaceMetadata) => {
  for (let port of Object.values(data.service_ports ?? {})) ports.add(port);

  for (let endpoints of Object.values(data.endpoint_ports))
    for (let port of Object.values(endpoints)) ports.add(port);
};

export let allocateServicePorts = async (project: ProjectRoot): Promise<ServicePorts> => {
  let reserved = new Set(standardPorts);

  for (let worktree of await listWorktrees(project.root)) {
    let data = metadataIfPresent(worktree.path);
    if (data) reserve(reserved, data);
  }

  let values = await allocatePortValues(reserved, 6);

  return {
    postgres: values[0]!,
    mongo: values[1]!,
    redis: values[2]!,
    nats: values[3]!,
    etcd_client: values[4]!,
    etcd_peer: values[5]!
  };
};

export let metadata = async (project: ProjectRoot): Promise<WorkspaceMetadata> => {
  let data = metadataIfPresent(project.root);
  if (data) {
    let source = canonical(project.root) === canonical(data.source_root);
    let updated = {
      ...data,
      hostname: source ? 'metorial-root.localhost' : workspaceHostname(data.id)
    };
    if (source) {
      updated.id = 'root';
      updated.runtime = 'host';
      updated.service_ports ??= await allocateServicePorts(project);
    }

    if (JSON.stringify(updated) !== JSON.stringify(data)) writeMetadata(project.root, updated);

    return updated;
  }

  let branch = await commands
    .output('git', ['branch', '--show-current'], project.root)
    .catch(() => '');
  branch ||= basename(project.root) || 'workspace';

  let source = await sourceRoot(project);
  let isSource = canonical(project.root) === canonical(source);
  data = {
    id: isSource ? 'root' : workspaceId(branch),
    hostname: isSource ? 'metorial-root.localhost' : workspaceHostname(branch),
    branch,
    source_root: source,
    runtime: isSource ? 'host' : 'docker',
    service_ports: isSource ? await allocateServicePorts(project) : undefined,
    endpoint_ports: {}
  };
  writeMetadata(project.root, data);

  return data;
};

export let configureManifests = async (project: ProjectRoot, manifests: LoadedManifest[]) => {
  let data = metadataIfPresent(project.root);
  if (!data) return;

  if (data.runtime === 'host') {
    if (!data.service_ports)
      throw new Error('host workspace metadata is missing service_ports');

    let unavailable = new Set<number>();

    for (let worktree of await listWorktrees(project.root)) {
      if (canonical(worktree.path) === canonical(project.root)) continue;

      let other = metadataIfPresent(worktree.path);
      if (other) reserve(unavailable, other);
    }

    let missing = manifests.flatMap(({ manifest }) =>
      manifest.package
        ? sortedEntries(manifest.endpoints)
            .filter(
              ([name]) =>
                data!.endpoint_ports[manifest.package!.name]?.[name] === undefined ||
                unavailable.has(data!.endpoint_ports[manifest.package!.name]![name]!)
            )
            .map(([name]) => [manifest.package!.name, name] as [string, string])
        : []
    );
    if (missing.length) {
      let reserved = new Set([
        ...standardPorts,
        ...Object.values(data.service_ports),
        ...unavailable,
        ...manifests.flatMap(item =>
          Object.values(item.manifest.endpoints).map(endpoint => endpoint.port)
        )
      ]);
      reserve(reserved, data);

      let values = await allocatePortValues(reserved, missing.length);

      for (let [index, [packageName, name]] of missing.entries())
        (data.endpoint_ports[packageName] ??= {})[name] = values[index]!;
      writeMetadata(project.root, data);
    }

    for (let { manifest } of manifests) {
      for (let db of Object.values(manifest.postgres)) {
        db.compose = undefined;
        db.service = undefined;
        db.port = data.service_ports.postgres;
      }

      for (let db of Object.values(manifest.mongo)) {
        db.compose = undefined;
        db.service = undefined;
        db.port = data.service_ports.mongo;
      }

      if (manifest.package)
        for (let [name, endpoint] of sortedEntries(manifest.endpoints))
          endpoint.bind_port = data.endpoint_ports[manifest.package.name]![name]!;
    }
  }
  refreshDependencyEndpoints(manifests, data.hostname);
  validateDependencyEndpoints(manifests);
};

let runtimeModule = async (project: ProjectRoot) =>
  (await metadata(project)).runtime === 'host'
    ? await import('./workspace-host')
    : await import('./workspace-dev');

export let addWorktree = async (repo: string, target: string, branch: string) => {
  let exists = await commands
    .output('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], repo)
    .then(
      () => true,
      () => false
    );
  await commands.run(
    'git',
    ['worktree', 'add', ...(exists ? [] : ['-b', branch]), target, exists ? branch : 'HEAD'],
    repo
  );

  return !exists;
};

export let removeWorktree = async (repo: string, target: string) => {
  if (existsSync(join(target, '.git'))) {
    try {
      await commands.run('git', ['worktree', 'remove', '--force', target], repo);

      return;
    } catch (error) {
      if (existsSync(join(target, '.git'))) throw error;
    }
  }
  rmSync(target, { recursive: true, force: true });

  await commands.run('git', ['worktree', 'prune'], repo);
};

let removePairedWorktrees = async (project: ProjectRoot, source: string, target: string) => {
  if (project.kind === 'enterprise' || existsSync(join(source, 'oss/package.json'))) {
    let repo = project.kind === 'enterprise' ? project.oss : join(source, 'oss');
    let ossTarget = join(target, 'oss');
    if (
      (await listWorktrees(repo)).some(item => canonical(item.path) === canonical(ossTarget))
    )
      await removeWorktree(repo, ossTarget);
  }

  await removeWorktree(source, target);
};

export let list = async (project: ProjectRoot) => {
  let source = await sourceRoot(project);

  for (let worktree of await listWorktrees(project.root)) {
    if (
      canonical(worktree.path) !== canonical(source) &&
      (worktree.prunable || !existsSync(join(worktree.path, '.git')))
    ) {
      console.error(`pruning stale workspace ${worktree.path}`);

      await removePairedWorktrees(project, source, worktree.path).catch(error =>
        console.error(`warning: could not prune stale workspace: ${error}`)
      );
    }
  }

  return (await listWorktrees(project.root))
    .filter(item => canonical(item.path) !== canonical(source) && item.branch)
    .map(item => {
      let data: WorkspaceMetadata | undefined;

      try {
        data = metadataIfPresent(item.path);
      } catch {}

      return { ...item, id: data?.id, hostname: data?.hostname, runtime: data?.runtime };
    })
    .sort((a, b) => (a.branch! < b.branch! ? -1 : a.branch! > b.branch! ? 1 : 0));
};

export let resolve = async (project: ProjectRoot, branch?: string) => {
  if (branch === undefined) return project;
  validateBranch(branch);

  let worktree = (await listWorktrees(project.root)).find(item => item.branch === branch);
  if (!worktree) throw new Error(`no workspace found for branch ${JSON.stringify(branch)}`);

  if (canonical(worktree.path) === canonical(await sourceRoot(project)))
    throw new Error(
      `branch ${JSON.stringify(branch)} is the source checkout, not a workspace; omit the branch name to operate on the current directory`
    );

  return detect(worktree.path);
};

export let remove = async (project: ProjectRoot, branch: string) => {
  validateBranch(branch);

  let source = await sourceRoot(project);
  let worktree = (await listWorktrees(project.root)).find(item => item.branch === branch);
  if (!worktree) throw new Error(`no workspace found for branch ${JSON.stringify(branch)}`);

  if (canonical(worktree.path) === canonical(source))
    throw new Error('cannot remove the source checkout');

  if (within(canonical(worktree.path), canonical(process.cwd()))) {
    throw new Error(
      `cannot remove the workspace you are currently in; run from the source checkout at ${source}`
    );
  }

  let target: ProjectRoot | undefined;

  try {
    target = detect(worktree.path);
  } catch {}

  if (target) {
    await (
      await runtimeModule(target)
    )
      .stop(target, true)
      .catch(error =>
        console.error(`warning: could not remove workspace Docker resources: ${error}`)
      );
  }

  await removePairedWorktrees(project, source, worktree.path);
  console.log(`removed workspace ${worktree.path}`);
};

export let create = async (project: ProjectRoot, branch: string, openCode: boolean) => {
  validateBranch(branch);

  let id = workspaceId(branch);
  if (id === 'root')
    throw new Error('workspace name `root` is reserved for the main checkout');

  for (let worktree of await listWorktrees(project.root)) {
    let existingId =
      metadataIfPresent(worktree.path)?.id ??
      (worktree.branch ? workspaceId(worktree.branch) : undefined);
    if (existingId === id)
      throw new Error(
        `workspace identifier ${JSON.stringify(id)} is already used by ${worktree.path}`
      );
  }

  let target = workspacePath(project.root, branch);
  if (existsSync(target)) throw new Error(`workspace path already exists: ${target}`);

  let ports = await allocateServicePorts(project);
  let rootCreated = await addWorktree(project.root, target, branch);
  let ossCreated = false;
  let initialized = false;

  try {
    if (project.kind === 'enterprise') {
      let targetOss = join(target, 'oss');
      if (existsSync(targetOss)) {
        if (readdirSync(targetOss).length)
          throw new Error(`enterprise worktree contains non-empty OSS path ${targetOss}`);
        rmSync(targetOss, { recursive: true });
      }
      ossCreated = await addWorktree(project.oss, targetOss, branch);
    }

    await commands.run(
      'git',
      ['submodule', 'update', '--init', '--recursive'],
      project.kind === 'enterprise' ? join(target, 'oss') : target
    );
    writeMetadata(target, {
      id,
      hostname: 'localhost',
      branch,
      source_root: project.root,
      runtime: 'host',
      service_ports: ports,
      endpoint_ports: {}
    });
    console.log(`created workspace ${target}`);

    if (existsSync(join(project.root, 'env.json')) && !existsSync(join(target, 'env.json'))) {
      copyFileSync(join(project.root, 'env.json'), join(target, 'env.json'));
      console.log('copied env.json');
    }

    let targetProject = detect(target);
    await configureManifests(targetProject, discover(target));

    await (await import('./workspace-host')).initialize(targetProject, true);
    initialized = true;
  } catch (error) {
    try {
      await (await import('./workspace-host')).stop(detect(target), true);
    } catch {}

    if (project.kind === 'enterprise') {
      await removeWorktree(project.oss, join(target, 'oss')).catch(() => {});

      if (ossCreated)
        await commands.run('git', ['branch', '-D', branch], project.oss).catch(() => {});
    }

    await removeWorktree(project.root, target).catch(() => {});

    if (rootCreated)
      await commands.run('git', ['branch', '-D', branch], project.root).catch(() => {});
    throw new Error('workspace creation or initialization failed and was rolled back', {
      cause: error
    });
  }

  if (initialized && openCode) await (await import('./workspace-host')).open(detect(target));

  return target;
};
