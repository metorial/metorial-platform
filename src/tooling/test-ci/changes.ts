import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, normalize, join } from 'node:path';

export let suites = [
  { name: 'forge', package: '@metorial/forge', services: ['forge'] },
  { name: 'nebula', package: '@metorial/nebula', services: ['nebula'] },
  {
    name: 'function-bay',
    package: '@metorial/function-bay',
    services: ['function-bay', 'forge']
  },
  {
    name: 'shuttle',
    package: '@metorial/shuttle',
    services: ['shuttle', 'forge', 'function-bay']
  },
  {
    name: 'slates-hub',
    package: '@metorial/slates',
    services: ['slates', 'forge', 'function-bay', 'signal']
  },
  { name: 'relay', package: '@metorial/relay', services: ['relay'] },
  { name: 'voyager', package: '@metorial/voyager', services: ['voyager'] }
];

export let affected = (paths: string[], directories: string[], global: boolean) =>
  global ||
  paths.some(path =>
    directories.some(directory => path === directory || path.startsWith(`${directory}/`))
  );

if (import.meta.main) {
  let git = (...args: string[]) => {
    let result = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'inherit' });
    if (result.exitCode) throw new Error(`git ${args.join(' ')} failed`);
    return result.stdout.toString().trim();
  };
  let event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8'));
  let enterprise = (await Bun.file('package.json').json()).name === '@metorial/enterprise';
  let prefix = enterprise ? 'oss/' : '';
  let base = event.pull_request?.base.sha ?? event.before;
  let paths: string[] = [];
  let all =
    process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' || !base || /^0+$/.test(base);

  if (!all) {
    if (event.pull_request) base = git('merge-base', base, 'HEAD');
    paths = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
    if (enterprise && paths.includes('oss')) {
      let previous = git('rev-parse', `${base}:oss`);
      let current = git('-C', 'oss', 'rev-parse', 'HEAD');
      let present = Bun.spawnSync(['git', '-C', 'oss', 'cat-file', '-e', previous]);
      if (present.exitCode) git('-C', 'oss', 'fetch', 'origin', previous);
      paths = paths.filter(path => path !== 'oss');
      paths.push(
        ...git('-C', 'oss', 'diff', '--name-only', previous, current)
          .split('\n')
          .filter(Boolean)
          .map(path => `oss/${path}`)
      );
    }
  }

  let packages = new Map<string, { directory: string; dependencies: string[] }>();
  let manifest = await Bun.file('package.json').json();
  for (let pattern of manifest.workspaces) {
    for (let file of new Bun.Glob(`${pattern}/package.json`).scanSync({ onlyFiles: true })) {
      let value = await Bun.file(file).json();
      if (value.name)
        packages.set(value.name, {
          directory: dirname(file),
          dependencies: Object.keys({
            ...value.dependencies,
            ...value.devDependencies,
            ...value.optionalDependencies,
            ...value.peerDependencies
          })
        });
    }
  }
  let closure = (name: string, seen = new Set<string>()): string[] => {
    if (seen.has(name)) return [];
    seen.add(name);
    let value = packages.get(name);
    if (!value) return [];
    return [
      value.directory,
      ...value.dependencies.flatMap(dependency => closure(dependency, seen))
    ];
  };
  let globalPaths = [
    'package.json',
    'bun.lock',
    'bunfig.toml',
    'turbo.json',
    'tsconfig.json',
    '.npmrc',
    '.bun-version',
    '.node-version'
  ];
  let global =
    all ||
    paths.some(
      path =>
        /^((oss\/)?tsconfig[^/]*\.json)$/.test(path) ||
        globalPaths.includes(path) ||
        globalPaths.includes(path.replace(/^oss\//, '')) ||
        path.startsWith(`${prefix}src/tooling/test-ci/`) ||
        path.startsWith(`${prefix}src/tooling/docker-build/`) ||
        path.startsWith(`${prefix}.github/actions/setup-test-workspace/`) ||
        path.startsWith(`${prefix}.github/actions/detect-test-changes/`)
    );
  let unitGlobal =
    global ||
    paths.includes(
      enterprise ? '.github/workflows/deploy-backend.yml' : '.github/workflows/test.yml'
    );
  let e2eGlobal =
    global ||
    paths.some(
      path =>
        path.startsWith(`${prefix}.github/actions/backend-e2e/`) ||
        path ===
          (enterprise
            ? '.github/workflows/deploy-backend.yml'
            : '.github/workflows/backend-services.yml')
    );
  let tasks = process.env.TEST_TASKS!.split(/\s+/);
  let graphResult = Bun.spawnSync(['bunx', 'turbo@2.9.18', 'run', ...tasks, '--dry=json'], {
    stdout: 'pipe',
    stderr: 'inherit'
  });
  if (graphResult.exitCode) throw new Error('Test graph discovery failed');
  let graph = JSON.parse(graphResult.stdout.toString());
  let taskMap = new Map<string, any>(graph.tasks.map((task: any) => [task.taskId, task]));
  let graphInputs = (id: string, seen = new Set<string>()): string[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    let task = taskMap.get(id);
    if (!task) return [];
    return [
      task.directory,
      ...Object.keys(task.inputs ?? {}).map(path => normalize(join(task.directory, path))),
      ...task.dependencies.flatMap((dependency: string) => graphInputs(dependency, seen))
    ];
  };
  let units = [
    ...new Set<string>(
      graph.tasks
        .filter((task: any) => task.task === 'test' && task.command !== '<NONEXISTENT>')
        .map((task: any) => task.package)
    )
  ].filter(name =>
    affected(paths, [...closure(name), ...graphInputs(`${name}#test`)], unitGlobal)
  );
  let selected = suites.filter(suite =>
    affected(
      paths,
      [...closure(suite.package), ...suite.services.map(service => `${prefix}src/${service}`)],
      e2eGlobal
    )
  );
  let conduit = affected(
    paths,
    closure('@metorial-subspace/conduit'),
    global || paths.includes(`${prefix}.github/workflows/conduit-integration.yml`)
  );
  let outputs = {
    units: String(units.length > 0),
    'unit-tasks': ['test', ...units.map(name => `--filter=${name}`)].join(' '),
    e2e: String(selected.length > 0),
    matrix: JSON.stringify({
      service: selected.map(({ name, package: pkg }) => ({ name, package: pkg }))
    }),
    conduit: String(conduit)
  };
  console.log(
    JSON.stringify(
      { base, paths, units, suites: selected.map(suite => suite.name), conduit },
      null,
      2
    )
  );
  for (let [name, value] of Object.entries(outputs))
    appendFileSync(process.env.GITHUB_OUTPUT!, `${name}=${value}\n`);
}
