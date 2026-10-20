import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, normalize, join, relative, basename } from 'node:path';

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

let stackServices = ['forge', 'function-bay', 'nebula', 'shuttle', 'voyager', 'relay'];

/** Suites run by `control test:e2e`: the stack package plus every test package matching `tests`. */
export let controlSuites = {
  oss: {
    name: 'metorial',
    package: '@metorial/app-api',
    stackPackages: [] as string[],
    workspacePackages: [] as string[],
    services: stackServices,
    tests: ['src/metorial/products/*/modules/*', 'src/metorial/apis/*']
  },
  enterprise: {
    name: 'metorial-enterprise',
    package: '@metorial/mte-core-api',
    stackPackages: ['@metorial/mte-worker'],
    // Loaded by the enterprise e2e bootstrap but not declared there, because declaring it would form
    // a dependency cycle through the federation modules' own e2e devDependencies.
    workspacePackages: ['@metorial-enterprise/fabric'],
    services: stackServices,
    tests: ['src/metorial/modules/*', 'src/metorial/apis/*']
  }
};

export type ControlSuite = (typeof controlSuites)['oss'];

export let controlTestPackages = (
  suite: ControlSuite,
  packages: Map<string, { directory: string; e2e: boolean }>
) =>
  [...packages]
    .filter(
      ([, value]) =>
        value.e2e && suite.tests.some(pattern => new Bun.Glob(pattern).match(value.directory))
    )
    .map(([name]) => name)
    .sort();

export let controlTasks = (suite: ControlSuite) =>
  [
    'prisma:generate',
    'test:e2e',
    ...suite.tests.map(pattern => `--filter=./${pattern}`),
    ...suite.workspacePackages.map(name => `--filter=${name}`)
  ].join(' ');

export let affected = (paths: string[], directories: string[], global: boolean) =>
  global ||
  paths.some(path =>
    directories.some(directory => path === directory || path.startsWith(`${directory}/`))
  );

export let testRelevantPaths = (paths: string[], documentationDirectories: string[]) => {
  let directories = new Set(documentationDirectories);
  return paths.filter(
    path => !(/^README[^/]*$/.test(basename(path)) && directories.has(dirname(path)))
  );
};

export let taskInputsChanged = (
  paths: string[],
  task: { directory: string; resolvedTaskDefinition: { inputs: string[] } }
) => {
  let patterns = task.resolvedTaskDefinition.inputs.length
    ? task.resolvedTaskDefinition.inputs
    : ['$TURBO_DEFAULT$'];
  let matches = (pattern: string, path: string) => {
    if (pattern === '$TURBO_DEFAULT$') {
      let local = relative(task.directory || '.', path);
      return local !== '..' && !local.startsWith('../');
    }
    return new Bun.Glob(normalize(join(task.directory || '.', pattern))).match(path);
  };
  return paths.some(
    path =>
      patterns.some(pattern => !pattern.startsWith('!') && matches(pattern, path)) &&
      !patterns.some(pattern => pattern.startsWith('!') && matches(pattern.slice(1), path))
  );
};

if (import.meta.main) {
  let started = performance.now();
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
    paths = git('diff', '--name-only', '--no-renames', '-z', base, 'HEAD')
      .split('\0')
      .filter(Boolean);
    if (enterprise && paths.includes('oss')) {
      let previous = git('rev-parse', `${base}:oss`);
      let current = git('-C', 'oss', 'rev-parse', 'HEAD');
      let present = Bun.spawnSync(['git', '-C', 'oss', 'cat-file', '-e', previous]);
      if (present.exitCode) git('-C', 'oss', 'fetch', 'origin', previous);
      paths = paths.filter(path => path !== 'oss');
      paths.push(
        ...git('-C', 'oss', 'diff', '--name-only', '--no-renames', '-z', previous, current)
          .split('\0')
          .filter(Boolean)
          .map(path => `oss/${path}`)
      );
    }
  }

  let packages = new Map<
    string,
    { directory: string; dependencies: string[]; e2e: boolean }
  >();
  let manifest = await Bun.file('package.json').json();
  for (let pattern of manifest.workspaces) {
    for (let file of new Bun.Glob(`${pattern}/package.json`).scanSync({ onlyFiles: true })) {
      let value = await Bun.file(file).json();
      if (value.name)
        packages.set(value.name, {
          directory: dirname(file),
          e2e: Boolean(value.scripts?.['test:e2e']),
          dependencies: Object.keys({
            ...value.dependencies,
            ...value.devDependencies,
            ...value.optionalDependencies,
            ...value.peerDependencies
          })
        });
    }
  }
  paths = testRelevantPaths(paths, [
    '.',
    prefix.slice(0, -1) || '.',
    ...[...packages.values()].map(value => value.directory),
    `${prefix}src/tooling/test-ci`,
    `${prefix}src/tooling/docker-build`,
    ...suites.flatMap(suite => suite.services.map(service => `${prefix}src/${service}`)),
    ...paths
      .filter(path => /^((oss\/)?\.github\/actions\/[^/]+\/README[^/]*)$/.test(path))
      .map(dirname)
  ]);
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
        path.startsWith(`${prefix}.github/actions/control-e2e/`) ||
        path.startsWith(`${prefix}.github/actions/image-artifact/`) ||
        path.startsWith(`${prefix}.github/actions/image-cache/`) ||
        path === `${prefix}.dockerignore` ||
        path ===
          (enterprise
            ? '.github/workflows/deploy-backend.yml'
            : '.github/workflows/backend-services.yml')
    );
  let tasks = process.env.TEST_TASKS!.split(/\s+/);
  let graphResult = Bun.spawnSync(['bunx', 'turbo@2.11.7', 'run', ...tasks, '--dry=json'], {
    stdout: 'pipe',
    stderr: 'inherit'
  });
  if (graphResult.exitCode) throw new Error('Test graph discovery failed');
  let graph = JSON.parse(graphResult.stdout.toString());
  let taskMap = new Map<string, any>(graph.tasks.map((task: any) => [task.taskId, task]));
  let taskChanged = (id: string, seen = new Set<string>()): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    let task = taskMap.get(id);
    if (!task) throw new Error(`Missing task in affected test graph: ${id}`);
    return (
      taskInputsChanged(paths, task) ||
      task.dependencies.some((dependency: string) => taskChanged(dependency, seen))
    );
  };
  let units = [
    ...new Set<string>(
      graph.tasks
        .filter((task: any) => task.task === 'test' && task.command !== '<NONEXISTENT>')
        .map((task: any) => task.package)
    )
  ].filter(name => unitGlobal || taskChanged(`${name}#test`));
  for (let suite of suites) {
    if (!packages.has(suite.package))
      throw new Error(`Missing E2E workspace: ${suite.package}`);
  }
  let selected = suites.filter(suite =>
    affected(
      paths,
      [...closure(suite.package), ...suite.services.map(service => `${prefix}src/${service}`)],
      e2eGlobal
    )
  );
  let controlSuite = enterprise ? controlSuites.enterprise : controlSuites.oss;
  if (!packages.has(controlSuite.package))
    throw new Error(`Missing E2E stack workspace: ${controlSuite.package}`);
  let controlSelected = affected(
    paths,
    [
      ...[controlSuite.package, ...controlSuite.stackPackages].flatMap(name => closure(name)),
      ...controlTestPackages(controlSuite, packages).flatMap(name => closure(name)),
      ...controlSuite.services.map(service => `${prefix}src/${service}`),
      `${prefix}src/control`,
      `${prefix}scripts/dev-tools/e2e`
    ],
    e2eGlobal
  );
  let matrix = [
    ...selected.map(({ name, package: pkg }) => ({
      name,
      package: pkg,
      control: false,
      workspace: enterprise ? './oss' : '.',
      tasks: `prisma:generate test:e2e --filter=${pkg}`
    })),
    ...(controlSelected
      ? [
          {
            name: controlSuite.name,
            package: controlSuite.package,
            control: true,
            workspace: '.',
            tasks: controlTasks(controlSuite)
          }
        ]
      : [])
  ];
  let conduit = affected(
    paths,
    closure('@metorial-subspace/conduit'),
    global || paths.includes(`${prefix}.github/workflows/conduit-integration.yml`)
  );
  let outputs = {
    units: String(units.length > 0),
    'unit-tasks': ['test', ...units.map(name => `--filter=${name}`)].join(' '),
    e2e: String(matrix.length > 0),
    matrix: JSON.stringify({ service: matrix }),
    conduit: String(conduit)
  };
  console.log(
    JSON.stringify(
      { base, paths, units, suites: matrix.map(suite => suite.name), conduit },
      null,
      2
    )
  );
  console.log(
    `Affected test selection: ${((performance.now() - started) / 1000).toFixed(1)}s`
  );
  for (let [name, value] of Object.entries(outputs))
    appendFileSync(process.env.GITHUB_OUTPUT!, `${name}=${value}\n`);
}
