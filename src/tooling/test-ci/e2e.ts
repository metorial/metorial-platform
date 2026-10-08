import { createClient } from '@lowerdeck/rpc-client';
import { prepareCompose } from './images';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

let [command, suite, sourceWorkspace, artifactDirectory] = process.argv.slice(2);
let directories: Record<string, string> = {
  forge: 'src/forge/service',
  nebula: 'src/nebula/service',
  'function-bay': 'src/function-bay/service',
  shuttle: 'src/shuttle/service',
  'slates-hub': 'src/slates/apps/hub',
  relay: 'src/relay/service',
  voyager: 'src/voyager/service'
};
let directory = directories[suite];
if (!directory) throw new Error(`Unknown E2E suite: ${suite}`);
let stack = resolve(process.env.RUNNER_TEMP ?? '/tmp', `test-stack-${suite}`);
let composePath = join(stack, 'compose.json');
let project = `ci-${suite}-${process.env.GITHUB_RUN_ID ?? process.pid}-${process.env.GITHUB_RUN_ATTEMPT ?? 1}`;
let run = (args: string[], cwd?: string, env?: Record<string, string>) => {
  let started = performance.now();
  let result = Bun.spawnSync(args, {
    cwd,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'inherit'
  });
  console.log(
    `${args.slice(0, 3).join(' ')}: ${((performance.now() - started) / 1000).toFixed(1)}s`
  );
  if (result.exitCode || args[0] === 'bunx' || args[0] === 'bun')
    console.log(result.stdout.toString());
  if (result.exitCode)
    throw new Error(`Command failed (${result.exitCode}): ${args.join(' ')}`);
  return result.stdout.toString();
};
let compose = (...args: string[]) =>
  run(['docker', 'compose', '-p', project, '-f', composePath, ...args]);

if (command === 'prepare') {
  mkdirSync(stack, { recursive: true });
  let revision = run(['git', 'rev-parse', 'HEAD'], sourceWorkspace).trim();
  let profiles = suite === 'slates-hub' ? ['hub', 'infra'] : ['infra', 'service'];
  let flags = profiles.flatMap(profile => ['--profile', profile]);
  let config = JSON.parse(
    run(
      [
        'docker',
        'compose',
        '-f',
        'docker-compose.dev.yml',
        '--env-file',
        '.env.ci',
        ...flags,
        'config',
        '--format',
        'json'
      ],
      join(sourceWorkspace, directory)
    )
  );
  let ciEnvironment = Object.fromEntries(
    readFileSync(join(sourceWorkspace, directory, '.env.ci'), 'utf8')
      .split('\n')
      .filter(line => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map(line => {
        let separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
  config.services[suite].environment = {
    ...ciEnvironment,
    ...config.services[suite].environment
  };
  let prepared = prepareCompose({
    config,
    suite,
    profiles,
    revision,
    readArtifact: name =>
      JSON.parse(readFileSync(join(artifactDirectory, `${name}.json`), 'utf8'))
  });
  config = prepared.config;
  let applications = prepared.applications;
  await Bun.write(composePath, JSON.stringify(config, null, 2));
  await Bun.write(join(stack, 'applications.json'), JSON.stringify(applications));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `compose=${composePath}\nproject=${project}\n`);
} else if (command === 'run') {
  let config = await Bun.file(composePath).json();
  let applications = (await Bun.file(join(stack, 'applications.json')).json()) as string[];
  compose('pull');
  let infrastructure = Object.keys(config.services).filter(
    name => !applications.includes(name)
  );
  compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '120', ...infrastructure);
  let refreshPorts = (names: string[]) => {
    for (let name of names) {
      for (let mapping of config.services[name].ports ?? []) {
        mapping.published = compose('port', name, String(mapping.target))
          .trim()
          .split(':')
          .at(-1);
      }
    }
  };
  refreshPorts(infrastructure);
  let hostUrl = (value: string) =>
    value.replace(
      /(\w+:\/\/)([^/@]+@)?([a-z-]+):(\d+)/g,
      (original, scheme, auth, host, port) => {
        let name = config['x-ci-hosts'][host] ?? host;
        let target = config.services[name]?.ports?.find(
          (mapping: any) => Number(mapping.target) === Number(port)
        );
        return target ? `${scheme}${auth ?? ''}127.0.0.1:${target.published}` : original;
      }
    );
  let testEnvironment = () => {
    let environment = Object.fromEntries(
      readFileSync(join(sourceWorkspace, directory, '.env.ci'), 'utf8')
        .split('\n')
        .filter(line => /^[A-Z][A-Z0-9_]*=/.test(line))
        .map(line => {
          let separator = line.indexOf('=');
          return [line.slice(0, separator), hostUrl(line.slice(separator + 1))];
        })
    ) as Record<string, string>;
    let redis = new URL(environment.REDIS_URL);
    redis.pathname = '/1';
    environment.REDIS_URL = redis.toString();
    if (suite === 'relay') {
      let url = new URL(environment.DATABASE_URL);
      url.pathname = '/padd_relay_test';
      environment.DATABASE_URL = url.toString();
      environment.PADD_RELAY_TEST_DATABASE_URL = url.toString();
    }
    return environment;
  };
  let environment = testEnvironment();
  let databases = new Set<string>();
  for (let name of applications) {
    for (let key of ['DATABASE_URL', 'SEARCH_DATABASE_URL']) {
      if (config.services[name].environment[key])
        databases.add(new URL(config.services[name].environment[key]).pathname.slice(1));
    }
  }
  databases.add(new URL(environment.DATABASE_URL).pathname.slice(1));
  let postgres = config.services.postgres.environment;
  for (let database of databases) {
    if (!/^[a-z0-9_-]+$/.test(database)) throw new Error(`Invalid CI database: ${database}`);
    let found = compose(
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      postgres.POSTGRES_USER,
      '-d',
      postgres.POSTGRES_DB,
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname='${database}'`
    ).trim();
    if (found !== '1')
      compose('exec', '-T', 'postgres', 'createdb', '-U', postgres.POSTGRES_USER, database);
  }
  run(['bun', 'prisma', 'db', 'push', '--accept-data-loss'], directory, environment);
  compose('up', '-d', '--no-build', '--wait', '--wait-timeout', '240');
  refreshPorts(applications);
  environment = testEnvironment();
  for (let name of applications) {
    let service = config.services[name];
    let container = compose('ps', '-q', name).trim();
    let actual = JSON.parse(run(['docker', 'inspect', container]))[0];
    if (actual.Config.Image !== service.image)
      throw new Error(`Container image mismatch: ${name}`);
    let port = service.ports[0].published;
    let response = await fetch(`http://127.0.0.1:${port}/ping`);
    if (!response.ok) throw new Error(`HTTP smoke failed for ${name}: ${response.status}`);
    console.log(`HTTP smoke passed: ${name} (${service.image})`);
    let rpcPort = ['slates-hub', 'slates-registry'].includes(name)
      ? service.ports[1].published
      : port;
    let path = ['slates-hub', 'slates-registry'].includes(name) ? name : `metorial-${name}`;
    let client = createClient<any>({
      endpoint: `http://127.0.0.1:${rpcPort}/${path}`,
      timeoutMs: 15000
    });
    let resource = ['signal', 'relay'].includes(name) ? 'sender' : 'tenant';
    let identifier = `ci-${suite}-smoke`;
    let created = await client[resource].upsert({ name: 'CI smoke', identifier });
    let found = await client[resource].get({ [`${resource}Id`]: created.id });
    if (found.id !== created.id || found.identifier !== identifier)
      throw new Error(`RPC smoke failed for ${name}`);
    console.log(`RPC create/get smoke passed: ${name}`);
  }
  if (suite !== 'voyager') {
    run(
      [
        'bunx',
        'turbo@2.9.18',
        'run',
        'test:e2e',
        `--filter=${JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).name}`,
        '--ui=stream'
      ],
      undefined,
      environment
    );
  }
  console.log(`E2E completed: ${suite}`);
} else if (command === 'cleanup') {
  if (existsSync(composePath)) {
    try {
      console.log(compose('logs', '--tail=100'));
    } finally {
      compose('down', '--volumes', '--remove-orphans');
    }
  }
} else throw new Error(`Unknown E2E command: ${command}`);
